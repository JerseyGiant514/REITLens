import { supabase } from './supabaseClient';

const SEC_BASE_URL = 'https://data.sec.gov/api/xbrl/companyfacts';
const USER_AGENT = 'REITLens Analytics Platform admin@reitlens.com';

interface SECFact {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy: number;
  fp: string;
  form: string;
  filed: string;
  frame?: string;
}

interface SECFactSet {
  label: string;
  description: string;
  units: {
    USD?: SECFact[];
    shares?: SECFact[];
    'USD/shares'?: SECFact[];
    [key: string]: SECFact[] | undefined;
  };
}

interface SECCompanyFacts {
  cik: string;
  entityName: string;
  facts: {
    'us-gaap'?: { [key: string]: SECFactSet };
    'dei'?: { [key: string]: SECFactSet };
  };
}

export interface QuarterlyFundamentals {
  ticker: string;
  fiscalDate: Date;
  period: string;
  fiscalYear: number;
  calendarYear: number;
  calendarQuarter: number;
  revenue: number;
  operatingIncome: number;
  netIncome: number;
  ffo?: number;
  affo?: number;
  noi?: number;
  totalAssets?: number;
  totalDebt?: number;
  totalEquity?: number;
  operatingCashFlow?: number;
  capex?: number;
  dividendsPaid?: number;
  propertyPlantEquipmentNet?: number;
  // New fields for real FFO/AFFO computation
  depreciationAndAmortization?: number;
  gainLossOnSaleOfProperties?: number;
  interestExpense?: number;
  dividendsPerShare?: number;
}

export class EDGARService {
  /**
   * Fetch company facts from SEC EDGAR API
   */
  static async fetchCompanyFacts(cik: string): Promise<SECCompanyFacts | null> {
    try {
      const paddedCik = cik.padStart(10, '0');
      const url = `${SEC_BASE_URL}/CIK${paddedCik}.json`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`SEC API returned ${response.status}`);
      }

      const data = await response.json();
      return data as SECCompanyFacts;

    } catch (error: any) {
      // failed to fetch from SEC EDGAR
      return null;
    }
  }

  /**
   * Extract quarterly fundamentals from SEC XBRL facts
   */
  static parseQuarterlyFundamentals(
    data: SECCompanyFacts,
    ticker: string,
    lookbackYears: number = 10
  ): QuarterlyFundamentals[] {
    if (!data.facts || !data.facts['us-gaap']) {
      // no US-GAAP facts found
      return [];
    }

    const facts = data.facts['us-gaap'];
    const dei = data.facts['dei'];

    // Extract quarterly data (form 10-Q)
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - lookbackYears);

    // Get all relevant fact sets - existing fields
    const revenues = this.getFactValues(facts, ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet']);
    const operatingIncome = this.getFactValues(facts, ['OperatingIncomeLoss', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest']);
    const netIncome = this.getFactValues(facts, ['NetIncomeLoss', 'ProfitLoss']);
    const assets = this.getFactValues(facts, ['Assets']);
    const debt = this.getFactValues(facts, ['LongTermDebt', 'DebtInstrumentCarryingAmount', 'LongTermDebtAndCapitalLeaseObligations']);
    const equity = this.getFactValues(facts, ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest']);
    const operatingCF = this.getFactValues(facts, ['NetCashProvidedByUsedInOperatingActivities']);
    const capex = this.getFactValues(facts, ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsForCapitalImprovements']);
    const dividends = this.getFactValues(facts, ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock']);
    const ppe = this.getFactValues(facts, ['PropertyPlantAndEquipmentNet']);

    // NEW: Fields for real FFO/AFFO computation
    const depreciation = this.getFactValues(facts, [
      'DepreciationDepletionAndAmortization',
      'DepreciationAndAmortization',
      'Depreciation',
      'DepreciationAmortizationAndAccretionNet',
      'DepreciationDepletionAndAmortizationExcludingDiscontinuedOperations',
    ]);

    const gainLossOnSales = this.getFactValues(facts, [
      'GainLossOnSaleOfProperties',
      'GainLossOnDispositionOfAssets',
      'GainsLossesOnSalesOfInvestmentRealEstate',
      'GainLossOnSaleOfPropertyPlantEquipment',
      'GainOnSaleOfProperties',
    ]);

    const interestExpenseValues = this.getFactValues(facts, [
      'InterestExpense',
      'InterestExpenseDebt',
      'InterestIncomeExpenseNet',
      'InterestAndDebtExpense',
    ]);

    // Dividends per share (in USD/shares units)
    const dividendsPerShare = this.getFactValuesPerShare(facts, [
      'CommonStockDividendsPerShareDeclared',
      'CommonStockDividendsPerShareCashPaid',
    ]);

    // Group by quarter (using 'end' date and 'fp' field)
    const quarterMap = new Map<string, Partial<QuarterlyFundamentals>>();

    // Process revenues (primary driver)
    revenues.forEach(fact => {
      if (fact.form === '10-Q' && fact.end) {
        const endDate = new Date(fact.end);
        if (endDate < cutoffDate) return;

        const key = `${fact.fy}-${fact.fp}`;

        if (!quarterMap.has(key)) {
          quarterMap.set(key, {
            ticker,
            fiscalDate: endDate,
            period: fact.fp,
            fiscalYear: fact.fy,
            calendarYear: endDate.getFullYear(),
            calendarQuarter: Math.floor(endDate.getMonth() / 3) + 1,
            revenue: 0,
            operatingIncome: 0,
            netIncome: 0
          });
        }

        const quarter = quarterMap.get(key)!;
        quarter.revenue = fact.val;
      }
    });

    // Add other metrics - existing
    this.mergeFactValues(quarterMap, operatingIncome, 'operatingIncome');
    this.mergeFactValues(quarterMap, netIncome, 'netIncome');
    this.mergeFactValues(quarterMap, assets, 'totalAssets');
    this.mergeFactValues(quarterMap, debt, 'totalDebt');
    this.mergeFactValues(quarterMap, equity, 'totalEquity');
    this.mergeFactValues(quarterMap, operatingCF, 'operatingCashFlow');
    this.mergeFactValues(quarterMap, capex, 'capex');
    this.mergeFactValues(quarterMap, dividends, 'dividendsPaid');
    this.mergeFactValues(quarterMap, ppe, 'propertyPlantEquipmentNet');

    // NEW: Merge FFO-related fields
    this.mergeFactValues(quarterMap, depreciation, 'depreciationAndAmortization');
    this.mergeFactValues(quarterMap, gainLossOnSales, 'gainLossOnSaleOfProperties');
    this.mergeFactValues(quarterMap, interestExpenseValues, 'interestExpense');
    this.mergeFactValues(quarterMap, dividendsPerShare, 'dividendsPerShare');

    // Compute FFO and AFFO from extracted XBRL data
    for (const [, quarter] of quarterMap) {
      const netInc = quarter.netIncome || 0;
      const dna = quarter.depreciationAndAmortization || 0;
      const gainLoss = quarter.gainLossOnSaleOfProperties || 0;

      // Real FFO = Net Income + D&A - Gains on Property Sales
      // NAREIT definition: FFO excludes depreciation of real estate assets
      // and gains/losses from sales of depreciable real estate
      if (dna > 0) {
        quarter.ffo = netInc + dna - gainLoss;
      }

      // AFFO = FFO - Maintenance CapEx (recurring capital expenditures)
      if (quarter.ffo !== undefined && quarter.capex) {
        // capex from XBRL is PaymentsToAcquirePropertyPlantAndEquipment
        // This is total capex; a more precise AFFO would split maintenance vs growth
        // For now, we use a conservative 60% of total capex as maintenance
        const maintenanceCapex = Math.round(quarter.capex * 0.60);
        quarter.affo = quarter.ffo - maintenanceCapex;
      }
    }

    // Convert to array and sort by date
    const quarters = Array.from(quarterMap.values())
      .filter(q => q.revenue && q.revenue > 0)
      .map(q => q as QuarterlyFundamentals)
      .sort((a, b) => b.fiscalDate.getTime() - a.fiscalDate.getTime());

    // Log extraction stats
    const withDnA = quarters.filter(q => q.depreciationAndAmortization && q.depreciationAndAmortization > 0).length;
    const withFFO = quarters.filter(q => q.ffo !== undefined).length;
    const withInterest = quarters.filter(q => q.interestExpense && q.interestExpense > 0).length;
    // parsed quarterly data

    return quarters;
  }

  /**
   * Get fact values from XBRL data, trying multiple possible field names (USD units)
   */
  private static getFactValues(
    facts: { [key: string]: SECFactSet },
    possibleNames: string[]
  ): SECFact[] {
    for (const name of possibleNames) {
      if (facts[name]?.units?.USD) {
        return facts[name].units.USD!;
      }
    }
    return [];
  }

  /**
   * Get fact values from XBRL data in USD/shares units (e.g., dividends per share)
   */
  private static getFactValuesPerShare(
    facts: { [key: string]: SECFactSet },
    possibleNames: string[]
  ): SECFact[] {
    for (const name of possibleNames) {
      if (facts[name]?.units?.['USD/shares']) {
        return facts[name].units['USD/shares']!;
      }
    }
    return [];
  }

  /**
   * Merge fact values into quarter map
   */
  private static mergeFactValues(
    quarterMap: Map<string, Partial<QuarterlyFundamentals>>,
    facts: SECFact[],
    field: keyof QuarterlyFundamentals
  ) {
    facts.forEach(fact => {
      if (fact.form === '10-Q' && fact.end) {
        const key = `${fact.fy}-${fact.fp}`;
        const quarter = quarterMap.get(key);
        if (quarter) {
          (quarter as any)[field] = fact.val;
        }
      }
    });
  }

  /**
   * Fetch and store quarterly fundamentals for a ticker
   */
  static async fetchAndStoreQuarterlyData(
    ticker: string,
    cik: string,
    lookbackYears: number = 10
  ): Promise<QuarterlyFundamentals[]> {
    // processing EDGAR data

    // Fetch from SEC
    const data = await this.fetchCompanyFacts(cik);
    if (!data) {
      throw new Error(`Failed to fetch SEC data for ${ticker}`);
    }

    // Parse quarterly data
    const quarters = this.parseQuarterlyFundamentals(data, ticker, lookbackYears);

    if (quarters.length === 0) {
      // no quarterly data found
      return [];
    }

    // Store in database
    await this.storeFundamentals(ticker, quarters);

    // Add rate limiting to be respectful to SEC servers
    await new Promise(resolve => setTimeout(resolve, 200));

    return quarters;
  }

  /**
   * Store fundamentals in database
   */
  private static async storeFundamentals(
    ticker: string,
    fundamentals: QuarterlyFundamentals[]
  ) {
    // Get REIT ID
    const { data: reit, error: reitError } = await supabase
      .from('reits')
      .select('id')
      .eq('ticker', ticker)
      .single();

    if (reitError) {
      // error fetching REIT from database
      return;
    }

    if (!reit) {
      // REIT not found in database, skipping storage
      return;
    }

    let stored = 0;
    let skipped = 0;
    let updated = 0;

    for (const fund of fundamentals) {
      const record = {
        reit_id: reit.id,
        fiscal_date: fund.fiscalDate.toISOString().split('T')[0],
        period: fund.period,
        fiscal_year: fund.fiscalYear,
        calendar_year: fund.calendarYear,
        calendar_quarter: fund.calendarQuarter,
        revenue: fund.revenue,
        operating_income: fund.operatingIncome || null,
        net_income: fund.netIncome,
        total_assets: fund.totalAssets || null,
        total_debt: fund.totalDebt || null,
        total_equity: fund.totalEquity || null,
        capex: fund.capex || null,
        // New FFO-related fields
        depreciation_amortization: fund.depreciationAndAmortization || null,
        gain_loss_on_sales: fund.gainLossOnSaleOfProperties || null,
        interest_expense: fund.interestExpense || null,
        dividends_per_share: fund.dividendsPerShare || null,
        ffo: fund.ffo || null,
        affo: fund.affo || null,
        data_source: 'EDGAR'
      };

      // Check if already exists
      const { data: existing } = await supabase
        .from('historical_financials')
        .select('id')
        .eq('reit_id', reit.id)
        .eq('fiscal_date', fund.fiscalDate.toISOString().split('T')[0])
        .maybeSingle();

      if (existing) {
        // Update existing record with new FFO fields if they have data
        if (fund.depreciationAndAmortization || fund.interestExpense || fund.ffo) {
          const { error: updateError } = await supabase
            .from('historical_financials')
            .update({
              depreciation_amortization: fund.depreciationAndAmortization || null,
              gain_loss_on_sales: fund.gainLossOnSaleOfProperties || null,
              interest_expense: fund.interestExpense || null,
              dividends_per_share: fund.dividendsPerShare || null,
              ffo: fund.ffo || null,
              affo: fund.affo || null,
            })
            .eq('id', existing.id);

          if (updateError) {
            // Column may not exist yet - silently skip update
            // The SQL migration needs to be run first to add these columns
          } else {
            updated++;
          }
        }
        skipped++;
        continue;
      }

      // Insert new record
      const { error } = await supabase
        .from('historical_financials')
        .insert(record);

      if (error) {
        // If error is about unknown columns, try inserting without new fields
        if (error.message.includes('depreciation_amortization') ||
            error.message.includes('gain_loss_on_sales') ||
            error.message.includes('interest_expense') ||
            error.message.includes('dividends_per_share') ||
            error.message.includes('ffo') ||
            error.message.includes('affo')) {
          // Fallback: insert without new fields (DB migration not yet applied)
          const { error: fallbackError } = await supabase
            .from('historical_financials')
            .insert({
              reit_id: reit.id,
              fiscal_date: fund.fiscalDate.toISOString().split('T')[0],
              period: fund.period,
              fiscal_year: fund.fiscalYear,
              calendar_year: fund.calendarYear,
              calendar_quarter: fund.calendarQuarter,
              revenue: fund.revenue,
              operating_income: fund.operatingIncome || null,
              net_income: fund.netIncome,
              total_assets: fund.totalAssets || null,
              total_debt: fund.totalDebt || null,
              total_equity: fund.totalEquity || null,
              capex: fund.capex || null,
              data_source: 'EDGAR'
            });
          if (fallbackError) {
            // error storing record (fallback)
          } else {
            stored++;
          }
        } else {
          // error storing record
        }
      } else {
        stored++;
      }
    }

    // storage complete
  }

  /**
   * Batch fetch for multiple REITs
   */
  static async batchFetchQuarterlyFundamentals(
    reits: Array<{ ticker: string; cik: string }>,
    lookbackYears: number = 10
  ): Promise<Map<string, QuarterlyFundamentals[]>> {
    const results = new Map<string, QuarterlyFundamentals[]>();

    for (const reit of reits) {
      try {
        const quarters = await this.fetchAndStoreQuarterlyData(
          reit.ticker,
          reit.cik,
          lookbackYears
        );
        results.set(reit.ticker, quarters);
      } catch (error: any) {
        // batch fetch failed for ticker
      }
    }

    // batch fetch complete
    return results;
  }
}
