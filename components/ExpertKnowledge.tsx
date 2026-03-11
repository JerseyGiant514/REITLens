
import React, { useState } from 'react';
import { BookOpen, Zap, Target, BarChart3, ShieldAlert, TrendingUp, Users, Building2, Server, Radio, Home, ShoppingBag, Briefcase, Hotel, Activity, AlertTriangle, CheckCircle2, Construction, Clock, DollarSign, Boxes, LineChart, TrendingDown, Package, Warehouse, Factory, Truck, Store, ShoppingCart, Heart, Microscope, Stethoscope } from 'lucide-react';
import { motion } from 'motion/react';

const ExpertKnowledge: React.FC = () => {
  const [selectedParentSector, setSelectedParentSector] = useState<string | null>(null);
  const [selectedSubsector, setSelectedSubsector] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'fundamentals' | 'sectors' | 'supply-demand' | 'development'>('fundamentals');

  const fundamentals = [
    {
      title: "The 90% Payout Myth",
      icon: <Zap className="text-gold" size={20} />,
      myth: "REITs can't grow because they must pay out 90% of their cash flow, leaving nothing for reinvestment.",
      reality: "The rule applies to 90% of TAXABLE INCOME, not cash flow. Because of heavy depreciation (a non-cash expense), taxable income is often significantly lower than AFFO. Institutional REITs frequently retain 20-30% of their true economic cash flow for internal growth.",
      stat: "A 10% increase in retained cash flow typically funds ~50-100bps of incremental internal growth without issuing a single share."
    },
    {
      title: "The Earnings Fallacy",
      icon: <ShieldAlert className="text-rose-400" size={20} />,
      myth: "REITs look expensive on a P/E basis compared to the S&P 500.",
      reality: "GAAP Net Income is irrelevant for REITs. Depreciation is a massive non-cash charge that artificially depresses 'Earnings.' Real estate generally maintains or increases in value. Specialists use P/AFFO or EV/EBITDAre to capture true economic yield.",
      stat: "For a typical high-quality REIT, AFFO is often 1.5x to 2.0x higher than GAAP Net Income."
    },
    {
      title: "Cost of Capital is the Product",
      icon: <Target className="text-lightBlue" size={20} />,
      myth: "REITs are just passive collections of buildings.",
      reality: "A REIT is a spread-investing machine. Their primary 'product' is their Weighted Average Cost of Capital (WACC). If a REIT's WACC is 5% and they can buy assets at a 6% cap rate, they are creating value. If their stock price drops and WACC hits 7%, their growth engine stalls.",
      stat: "A 50bps compression in WACC relative to peers can increase a REIT's justified multiple by 2-3 turns."
    }
  ];

  const sectorNuances = [
    {
      sector: "Residential",
      icon: <Home className="text-emerald-400" size={18} />,
      driver: "Regional Job Growth & Home Ownership Costs",
      insight: "Residential REITs are high-frequency inflation hedges. Leases reset every 12 months. The primary competitor isn't another apartment building; it's the cost of a monthly mortgage.",
      rule: "A 1% increase in local white-collar employment typically correlates to a 1.2% - 1.5% increase in Same-Store NOI growth."
    },
    {
      sector: "Industrial",
      icon: <Building2 className="text-pumpkin" size={18} />,
      driver: "E-commerce Penetration & Supply Chain Resilience",
      insight: "Location matters more than the building. 'Last-mile' facilities are essential infrastructure. Rent is a tiny fraction of a tenant's total supply chain cost (often <5%), making them less price-sensitive.",
      rule: "Every $1B increase in e-commerce sales requires approximately 1 million square feet of new distribution space."
    },
    {
      sector: "Data Centers",
      icon: <Server className="text-lightBlue" size={18} />,
      driver: "Power Availability & Interconnection",
      insight: "You aren't buying real estate; you are buying power capacity and a 'digital ecosystem.' The value is in the fiber cross-connects and the difficulty of securing new utility-grade power.",
      rule: "In Tier-1 markets, a 10% decrease in available power capacity leads to a 15-20% spike in market rental rates for wholesale colocation."
    },
    {
      sector: "Office",
      icon: <Briefcase className="text-slate-400" size={18} />,
      driver: "Tenant Retention & CapEx Leakage",
      insight: "Occupancy is a vanity metric; 'Economic Occupancy' is what matters. The cost to re-tenant an office (TIs and LCs) can eat 2-3 years of rent. High retention is the only way to generate positive CAD.",
      rule: "A 10% drop in tenant retention requires a ~15% increase in gross leasing volume just to keep net cash flow flat."
    },
    {
      sector: "Retail",
      icon: <ShoppingBag className="text-amber-400" size={18} />,
      driver: "Tenant Health & Sales PSF",
      insight: "Focus on 'Occupancy Cost Ratio' (Rent / Sales). If a tenant's OCR is <10%, they are profitable and likely to renew. If it hits 15%+, they are a credit risk.",
      rule: "For grocery-anchored centers, a 5% increase in anchor sales typically drives a 2-3% increase in small-shop (inline) rental spreads."
    },
    {
      sector: "Towers",
      icon: <Radio className="text-indigo-400" size={18} />,
      driver: "Carrier CapEx & Data Consumption",
      insight: "Towers are the ultimate 'moat' business. Adding a second tenant to a tower has near-100% incremental margin. They are play on global mobile data growth, not real estate.",
      rule: "A 2x increase in mobile data consumption typically requires a 20-30% increase in equipment loading on existing tower sites."
    },
    {
      sector: "Self-Storage",
      icon: <Warehouse className="text-cyan-400" size={18} />,
      driver: "Local Supply Discipline & Operating Leverage",
      insight: "Self-storage is the highest-margin REIT sector (70%+ NOI margins). Revenue management systems allow daily rate adjustments. The business is defensive, recession-resistant, and benefits from life transitions.",
      rule: "A 5% increase in occupancy typically drives 8-12% NOI growth due to extreme operating leverage (80%+ incremental margins)."
    },
    {
      sector: "Lodging",
      icon: <Hotel className="text-rose-400" size={18} />,
      driver: "RevPAR & Pricing Power Cycles",
      insight: "Hotels are NOT traditional real estate—they're operating businesses with daily pricing. No leases = extreme cyclicality but also rapid recovery potential. RevPAR is king: Occupancy x ADR.",
      rule: "Every 10% increase in RevPAR flows through to EBITDA at 60-70% incremental margins (high fixed-cost structure)."
    },
    {
      sector: "Healthcare",
      icon: <Heart className="text-pink-400" size={18} />,
      driver: "Demographics & Reimbursement Policy",
      insight: "Healthcare REITs benefit from non-discretionary demand and aging demographics. Subsector matters enormously: MOBs are defensive, Life Science is cyclical/VC-dependent, Senior Housing is demographic play with labor risk.",
      rule: "80+ population growing 3-4% annually creates structural demand for senior housing. Every 1% increase in healthcare spending as % of GDP drives ~2-3% NOI growth for MOBs."
    }
  ];

  // Supply/Demand Dynamics with SUBSECTOR GRANULARITY
  const supplyDemandMetrics = [
    {
      parentSector: "Industrial",
      parentIcon: <Building2 className="text-pumpkin" size={20} />,
      subsectors: [
        {
          name: "Last-Mile Distribution",
          icon: <Truck className="text-pumpkin" size={18} />,
          timeline: "9-12 months",
          criticalPath: "Land acquisition in urban infill locations",
          marketBalance: "SUPPLY_CONSTRAINED" as const,
          supplyPipeline: { underConstruction: 5.2, permitted: 4.1, proposed: 5.8, keyConstraints: ["Urban land scarcity", "Municipal approvals", "Height restrictions"] },
          netAbsorption: {
            calculation: "Occupied SF (End) - Occupied SF (Start), heavily driven by same-day/next-day delivery",
            leadingIndicators: ["E-commerce penetration", "Urban population density", "Amazon/FedEx expansion plans"],
            typical: "20-30M SF quarterly in top metros",
            driverFormula: "$1B in urban e-commerce sales = 1.5M SF (higher density than bulk)"
          },
          sensitivity: {
            supplyShock: { scenario: "+10% supply", occupancyImpact: "-150 to -250 bps", rentGrowthImpact: "-250 to -400 bps", noiImpact: "-3% to -6%", timeToReversion: "9-15 months (absorbs quickly)" },
            demandSurge: { scenario: "+20% absorption", occupancyImpact: "+200 to +350 bps", rentGrowthImpact: "+500 to +900 bps", noiImpact: "+8% to +14%", timeToReversion: "6-12 months" }
          },
          developmentEconomics: {
            yieldOnCost: "6.0-7.0% (100-150 bps over market cap rate)",
            costPerSF: "$120-$200/SF (expensive urban land)",
            structuralAdvantage: "STRONG MOAT. Urban land is scarce and NIMBYs are fierce. Last-mile = essential infrastructure for e-commerce. Replacement cost barrier is high."
          }
        },
        {
          name: "Bulk Warehouses",
          icon: <Warehouse className="text-pumpkin" size={18} />,
          timeline: "8-11 months",
          criticalPath: "Large land parcels near intermodal hubs",
          marketBalance: "BALANCED" as const,
          supplyPipeline: { underConstruction: 4.8, permitted: 3.9, proposed: 5.5, keyConstraints: ["Land costs", "Rail/port proximity", "Spec vs. BTS risk"] },
          netAbsorption: {
            calculation: "Large-footprint (500K+ SF) occupancy changes",
            leadingIndicators: ["Inventory-to-sales ratios", "Port volumes", "3PL lease expirations"],
            typical: "15-20M SF quarterly",
            driverFormula: "Supply chain normalization = steady demand; inventory builds = demand spikes"
          },
          sensitivity: {
            supplyShock: { scenario: "+10% supply", occupancyImpact: "-250 to -400 bps", rentGrowthImpact: "-350 to -600 bps", noiImpact: "-5% to -9%", timeToReversion: "15-24 months" },
            demandSurge: { scenario: "+20% absorption", occupancyImpact: "+150 to +300 bps", rentGrowthImpact: "+400 to +700 bps", noiImpact: "+6% to +11%", timeToReversion: "9-15 months" }
          },
          developmentEconomics: {
            yieldOnCost: "6.5-7.5% (150-200 bps spread)",
            costPerSF: "$70-$120/SF (cheaper exurban land)",
            structuralAdvantage: "MODERATE MOAT. Supply responds quickly. Intermodal locations have some scarcity value but not as strong as last-mile."
          }
        },
        {
          name: "Manufacturing/Flex",
          icon: <Factory className="text-pumpkin" size={18} />,
          timeline: "10-14 months",
          criticalPath: "Clear height & heavy power requirements",
          marketBalance: "BALANCED" as const,
          supplyPipeline: { underConstruction: 2.9, permitted: 2.2, proposed: 3.4, keyConstraints: ["Power capacity", "Heavy truck access", "Specialized HVAC"] },
          netAbsorption: {
            calculation: "Flex/R&D occupancy (mix of office + warehouse)",
            leadingIndicators: ["Manufacturing PMI", "Reshoring trends", "Tech tenant expansions"],
            typical: "8-12M SF quarterly",
            driverFormula: "Onshoring wave = structural tailwind; higher rent/SF than bulk distribution"
          },
          sensitivity: {
            supplyShock: { scenario: "+10% supply", occupancyImpact: "-200 to -350 bps", rentGrowthImpact: "-300 to -500 bps", noiImpact: "-4% to -7%", timeToReversion: "18-24 months (longer lease terms)" },
            demandSurge: { scenario: "+20% absorption", occupancyImpact: "+150 to +250 bps", rentGrowthImpact: "+400 to +700 bps", noiImpact: "+6% to +10%", timeToReversion: "12-18 months" }
          },
          developmentEconomics: {
            yieldOnCost: "7.0-8.5% (200-300 bps spread)",
            costPerSF: "$100-$180/SF (specialized buildouts)",
            structuralAdvantage: "MODERATE MOAT. Higher barriers than commodity warehouse (power, specialized features). Onshoring trend is tailwind."
          }
        }
      ]
    },
    {
      parentSector: "Residential",
      parentIcon: <Home className="text-emerald-400" size={20} />,
      subsectors: [
        {
          name: "Apartments (Multifamily)",
          icon: <Home className="text-emerald-400" size={18} />,
          timeline: "18-24 months",
          criticalPath: "Zoning & permitting (12-18 months)",
          marketBalance: "BALANCED" as const,
          supplyPipeline: { underConstruction: 3.5, permitted: 4.8, proposed: 6.5, keyConstraints: ["NIMBY zoning", "Construction labor", "Financing costs"] },
          netAbsorption: {
            calculation: "Net move-ins: Leases signed - move-outs",
            leadingIndicators: ["Job growth", "Home prices", "Mortgage rates", "Household formation"],
            typical: "30,000-45,000 units quarterly in major metros",
            driverFormula: "1% job growth + 5% home price increase = 1.5-2% rent growth"
          },
          sensitivity: {
            supplyShock: { scenario: "+10% supply", occupancyImpact: "-250 to -400 bps", rentGrowthImpact: "-400 to -600 bps", noiImpact: "-5% to -8%", timeToReversion: "18-24 months" },
            demandSurge: { scenario: "+20% absorption", occupancyImpact: "+200 to +350 bps", rentGrowthImpact: "+500 to +800 bps", noiImpact: "+7% to +11%", timeToReversion: "12-18 months" }
          },
          developmentEconomics: {
            yieldOnCost: "5.5-6.5% (100-150 bps spread)",
            costPerSF: "$250-$450/unit (garden) to $350-$650/unit (mid-rise)",
            structuralAdvantage: "STRONG MOAT in coastal markets (SF, LA, NYC, Boston) due to permitting hell. Sunbelt has weaker moat (faster approvals)."
          }
        },
        {
          name: "Single Family Rental (SFR)",
          icon: <Home className="text-emerald-500" size={18} />,
          timeline: "12-18 months",
          criticalPath: "Land acquisition + home construction/acquisition",
          marketBalance: "BALANCED" as const,
          supplyPipeline: { underConstruction: 2.8, permitted: 3.5, proposed: 4.9, keyConstraints: ["Builder allocations", "Home affordability", "HOA approvals"] },
          netAbsorption: {
            calculation: "Net leased homes: New leases - vacancies",
            leadingIndicators: ["Existing home prices", "Mortgage rates", "Millennial household formation", "Urban exodus trends"],
            typical: "15,000-25,000 homes quarterly (institutionally managed)",
            driverFormula: "Every 1% increase in mortgage rates = 0.5-1.0% increase in SFR demand (rental becomes attractive)"
          },
          sensitivity: {
            supplyShock: { scenario: "+10% supply", occupancyImpact: "-200 to -350 bps", rentGrowthImpact: "-350 to -550 bps", noiImpact: "-4% to -7%", timeToReversion: "15-24 months" },
            demandSurge: { scenario: "+20% absorption", occupancyImpact: "+150 to +300 bps", rentGrowthImpact: "+450 to +750 bps", noiImpact: "+7% to +12%", timeToReversion: "12-18 months" }
          },
          developmentEconomics: {
            yieldOnCost: "6.0-7.5% (150-250 bps spread)",
            costPerSF: "$150-$300/home (varies widely by market)",
            structuralAdvantage: "MODERATE MOAT. Competes with for-sale homes. High switching costs (families don't move often). Higher capex than apartments."
          }
        },
        {
          name: "Manufactured Housing",
          icon: <Home className="text-emerald-300" size={18} />,
          timeline: "6-12 months",
          criticalPath: "Land acquisition for community",
          marketBalance: "SUPPLY_CONSTRAINED" as const,
          supplyPipeline: { underConstruction: 1.2, permitted: 0.9, proposed: 1.5, keyConstraints: ["Community land scarcity", "Stigma/NIMBYism", "Financing challenges"] },
          netAbsorption: {
            calculation: "New home placements in communities (tenants own home, lease land)",
            leadingIndicators: ["Affordable housing shortage", "Home price-to-income ratios", "Retiree demographics"],
            typical: "3,000-5,000 sites quarterly (institutional)",
            driverFormula: "Homes are affordable ($50-150K); land lease model creates stable cash flow"
          },
          sensitivity: {
            supplyShock: { scenario: "+10% supply (very rare)", occupancyImpact: "-100 to -200 bps", rentGrowthImpact: "-150 to -300 bps", noiImpact: "-2% to -4%", timeToReversion: "12-18 months" },
            demandSurge: { scenario: "+20% absorption", occupancyImpact: "+100 to +200 bps", rentGrowthImpact: "+300 to +500 bps", noiImpact: "+5% to +8%", timeToReversion: "18-24 months (supply constrained)" }
          },
          developmentEconomics: {
            yieldOnCost: "7.5-9.5% (250-400 bps spread)",
            costPerSF: "$20-$50K per site (land + infrastructure)",
            structuralAdvantage: "MASSIVE MOAT. New community development is nearly impossible (zoning stigma). Tenant retention is 15+ years. Recession-resistant (affordable)."
          }
        }
      ]
    },
    {
      parentSector: "Retail",
      parentIcon: <ShoppingBag className="text-amber-400" size={20} />,
      subsectors: [
        {
          name: "Grocery-Anchored Centers",
          icon: <ShoppingCart className="text-amber-400" size={18} />,
          timeline: "12-18 months",
          criticalPath: "Anchor tenant commitment (grocery)",
          marketBalance: "BALANCED" as const,
          supplyPipeline: { underConstruction: 2.5, permitted: 1.9, proposed: 2.8, keyConstraints: ["Anchor creditworthiness", "Traffic counts", "Demographics"] },
          netAbsorption: {
            calculation: "Inline tenant square footage leased net of closures",
            leadingIndicators: ["Grocery anchor sales PSF ($500+ is strong)", "Population growth", "Household income"],
            typical: "+8-12M SF quarterly (resilient)",
            driverFormula: "Grocery = necessity; OCR <8% for grocers = healthy; inline tenants benefit from traffic"
          },
          sensitivity: {
            supplyShock: { scenario: "+10% supply", occupancyImpact: "-150 to -250 bps", rentGrowthImpact: "-200 to -350 bps", noiImpact: "-3% to -5%", timeToReversion: "12-18 months" },
            demandSurge: { scenario: "+20% absorption", occupancyImpact: "+200 to +350 bps", rentGrowthImpact: "+400 to +700 bps", noiImpact: "+6% to +10%", timeToReversion: "12-18 months" }
          },
          developmentEconomics: {
            yieldOnCost: "7.5-9.0% (250-350 bps spread)",
            costPerSF: "$150-$300/SF",
            structuralAdvantage: "STRONG MOAT. Grocery is recession-resistant. E-commerce hasn't killed necessity retail. Good demographics = pricing power."
          }
        },
        {
          name: "Malls (A/B/C Quality)",
          icon: <Store className="text-amber-500" size={18} />,
          timeline: "24-36 months (for A malls)",
          criticalPath: "Anchor tenant pre-leasing",
          marketBalance: "OVERSUPPLY_RISK" as const,
          supplyPipeline: { underConstruction: 0.8, permitted: 0.4, proposed: 0.9, keyConstraints: ["Anchor bankruptcies", "E-commerce cannibalization", "Redevelopment viability"] },
          netAbsorption: {
            calculation: "NEGATIVE for B/C malls; slightly positive for A+ malls",
            leadingIndicators: ["Anchor retailer health", "E-commerce penetration", "Experiential tenant mix"],
            typical: "A malls: flat; B/C malls: -3-5M SF quarterly",
            driverFormula: "E-commerce penetration 15%+ = structural headwind; A+ malls pivot to experiential"
          },
          sensitivity: {
            supplyShock: { scenario: "+10% supply (N/A, no new malls being built)", occupancyImpact: "N/A", rentGrowthImpact: "N/A", noiImpact: "N/A", timeToReversion: "N/A" },
            demandSurge: { scenario: "+20% absorption (experiential recovery)", occupancyImpact: "+100 to +200 bps (A malls only)", rentGrowthImpact: "+200 to +400 bps", noiImpact: "+3% to +6%", timeToReversion: "24-36 months" }
          },
          developmentEconomics: {
            yieldOnCost: "N/A (no new malls pencil except trophy redevelopments)",
            costPerSF: "$400-$800/SF (luxury A+ only)",
            structuralAdvantage: "NONE for B/C malls (avoid). A+ malls have MODERATE MOAT due to location/brand. Focus on experiential (dining, entertainment)."
          }
        },
        {
          name: "Triple Net Lease",
          icon: <ShoppingBag className="text-amber-300" size={18} />,
          timeline: "6-9 months",
          criticalPath: "Single-tenant lease negotiation",
          marketBalance: "BALANCED" as const,
          supplyPipeline: { underConstruction: 1.5, permitted: 1.2, proposed: 2.1, keyConstraints: ["Tenant credit quality", "Lease terms (15-20 years)", "Location quality"] },
          netAbsorption: {
            calculation: "New NNN lease signings (drug stores, QSRs, banks, dollar stores)",
            leadingIndicators: ["Tenant expansion plans", "Corporate earnings", "Store closures"],
            typical: "+5-8M SF quarterly",
            driverFormula: "Tenant credit = king; investment-grade tenants = low cap rates; focus on necessity retail"
          },
          sensitivity: {
            supplyShock: { scenario: "+10% supply", occupancyImpact: "-50 to -100 bps (tenant commits long-term)", rentGrowthImpact: "-100 to -200 bps", noiImpact: "-1% to -3%", timeToReversion: "12-24 months" },
            demandSurge: { scenario: "+20% absorption", occupancyImpact: "+50 to +150 bps", rentGrowthImpact: "+200 to +400 bps", noiImpact: "+3% to +6%", timeToReversion: "12-18 months" }
          },
          developmentEconomics: {
            yieldOnCost: "6.5-8.0% (150-250 bps spread)",
            costPerSF: "$150-$350/building",
            structuralAdvantage: "MODERATE MOAT. Long-term leases create stability. Tenant concentration risk. Focus on necessity retail (pharmacies, grocers, dollar stores)."
          }
        }
      ]
    },
    {
      parentSector: "Lodging",
      parentIcon: <Hotel className="text-rose-400" size={20} />,
      subsectors: [
        {
          name: "Full-Service Hotels",
          icon: <Hotel className="text-rose-400" size={18} />,
          timeline: "24-36 months",
          criticalPath: "Brand franchise + construction financing",
          marketBalance: "BALANCED" as const,
          supplyPipeline: { underConstruction: 2.8, permitted: 2.1, proposed: 3.2, keyConstraints: ["Brand standards", "F&B operations", "Meeting space", "Urban land costs"] },
          netAbsorption: {
            calculation: "RevPAR penetration vs. comp set (Occupancy x ADR)",
            leadingIndicators: ["Business travel recovery", "Conference bookings", "Corporate T&E budgets", "International tourism"],
            typical: "RevPAR: +5-10% in expansion, -30-50% in recession",
            driverFormula: "Group/business = 60-70% of revenue; weekend leisure fills gaps"
          },
          sensitivity: {
            supplyShock: { scenario: "+10% supply", occupancyImpact: "-400 to -600 bps", rentGrowthImpact: "-600 to -1000 bps (ADR compression)", noiImpact: "-20% to -30%", timeToReversion: "30-48 months" },
            demandSurge: { scenario: "+20% demand (recovery boom)", occupancyImpact: "+500 to +800 bps", rentGrowthImpact: "+1000 to +2000 bps", noiImpact: "+50% to +90%", timeToReversion: "12-24 months" }
          },
          developmentEconomics: {
            yieldOnCost: "9.0-11.0% (300-500 bps spread, cyclical)",
            costPerSF: "$400-$700K per key (luxury/CBD)",
            structuralAdvantage: "NONE currently (oversupply risk + WFH impact on business travel). Extreme cyclicality. Only for cycle-timers."
          }
        },
        {
          name: "Select-Service Hotels",
          icon: <Hotel className="text-rose-300" size={18} />,
          timeline: "18-24 months",
          criticalPath: "Brand franchise agreement",
          marketBalance: "BALANCED" as const,
          supplyPipeline: { underConstruction: 2.2, permitted: 1.7, proposed: 2.4, keyConstraints: ["Brand standards", "Location", "Labor costs"] },
          netAbsorption: {
            calculation: "RevPAR vs. comp set (more leisure-driven)",
            leadingIndicators: ["Consumer spending", "Airline capacity", "Road traffic", "Regional tourism"],
            typical: "RevPAR: +8-12% in expansion, -20-35% in recession",
            driverFormula: "Leisure = 70-80% of demand; less cyclical than full-service; lower fixed costs"
          },
          sensitivity: {
            supplyShock: { scenario: "+10% supply", occupancyImpact: "-300 to -500 bps", rentGrowthImpact: "-500 to -800 bps", noiImpact: "-15% to -25%", timeToReversion: "24-36 months" },
            demandSurge: { scenario: "+20% demand", occupancyImpact: "+400 to +700 bps", rentGrowthImpact: "+800 to +1500 bps", noiImpact: "+40% to +70%", timeToReversion: "15-24 months" }
          },
          developmentEconomics: {
            yieldOnCost: "9.5-12.0% (350-500 bps spread)",
            costPerSF: "$150-$250K per key",
            structuralAdvantage: "MODERATE MOAT. Less cyclical than full-service. Lower operating costs. Good for leisure-driven markets."
          }
        },
        {
          name: "Extended Stay",
          icon: <Hotel className="text-rose-500" size={18} />,
          timeline: "15-20 months",
          criticalPath: "Site selection + brand",
          marketBalance: "SUPPLY_CONSTRAINED" as const,
          supplyPipeline: { underConstruction: 1.5, permitted: 1.1, proposed: 1.8, keyConstraints: ["Limited brand penetration", "Hybrid business/leisure demand"] },
          netAbsorption: {
            calculation: "Occupancy-driven (long stays = less churn)",
            leadingIndicators: ["Corporate relocations", "Project-based work", "Housing shortages", "Insurance displacement"],
            typical: "Most defensive lodging subsector; occupancy holds 70-80% even in recessions",
            driverFormula: "Average stay = 20-30 nights; demand from construction crews, nurses, relocating families"
          },
          sensitivity: {
            supplyShock: { scenario: "+10% supply", occupancyImpact: "-200 to -350 bps", rentGrowthImpact: "-300 to -500 bps", noiImpact: "-10% to -15%", timeToReversion: "18-24 months" },
            demandSurge: { scenario: "+20% demand", occupancyImpact: "+250 to +400 bps", rentGrowthImpact: "+500 to +900 bps", noiImpact: "+30% to +50%", timeToReversion: "12-18 months" }
          },
          developmentEconomics: {
            yieldOnCost: "10.0-13.0% (400-600 bps spread)",
            costPerSF: "$120-$200K per key",
            structuralAdvantage: "STRONG MOAT. Most defensive lodging subsector. Long average stays = less cyclical. Housing shortage = structural tailwind."
          }
        }
      ]
    },
    // Continue with other parent sectors...
    {
      parentSector: "Data Centers",
      parentIcon: <Server className="text-lightBlue" size={20} />,
      subsectors: [
        {
          name: "Hyperscale Data Centers",
          icon: <Server className="text-lightBlue" size={18} />,
          timeline: "18-36 months",
          criticalPath: "POWER PROCUREMENT (18-24 month lead time)",
          marketBalance: "SUPPLY_CONSTRAINED" as const,
          supplyPipeline: { underConstruction: 8.5, permitted: 12.3, proposed: 18.7, keyConstraints: ["Utility-grade power (100+ MW)", "Substation interconnection", "Cooling infrastructure", "Fiber density"] },
          netAbsorption: {
            calculation: "Track MW of power leased, not just SF. 1 MW ≈ 8,000-10,000 SF",
            leadingIndicators: ["Hyperscaler capex (AWS/Azure/GCP)", "AI/ML compute demand", "Cloud migration rates"],
            typical: "150-250 MW quarterly absorption in Tier-1 markets",
            driverFormula: "AI training model = 10-50 MW of power demand per facility"
          },
          sensitivity: {
            supplyShock: { scenario: "+10% supply", occupancyImpact: "-100 to -200 bps", rentGrowthImpact: "-200 to -400 bps", noiImpact: "-2% to -4%", timeToReversion: "6-12 months (hyperscale demand is massive)" },
            demandSurge: { scenario: "+20% absorption (AI boom)", occupancyImpact: "+300 to +500 bps", rentGrowthImpact: "+500 to +1000 bps (CRITICAL SHORTAGE)", noiImpact: "+8% to +15%", timeToReversion: "24-36 months (new supply takes years)" }
          },
          developmentEconomics: {
            yieldOnCost: "7.0-9.0% (200-350 bps over market cap rate of 5.0-5.5%)",
            costPerSF: "$800-$1,500/SF (varies by power density)",
            structuralAdvantage: "MASSIVE MOAT. 18-36 month timeline + power constraints create 2-3 years of pricing power when demand surges. Existing operators with power capacity are kings."
          }
        }
      ]
    },
    {
      parentSector: "Office",
      parentIcon: <Briefcase className="text-slate-400" size={20} />,
      subsectors: [
        {
          name: "Trophy Office (Class A+)",
          icon: <Briefcase className="text-slate-300" size={18} />,
          timeline: "24-36 months",
          criticalPath: "Pre-leasing commitments (50%+ required)",
          marketBalance: "BALANCED" as const,
          supplyPipeline: { underConstruction: 2.8, permitted: 1.9, proposed: 3.2, keyConstraints: ["Pre-leasing requirements", "Trophy-quality finishes", "WFH structural headwinds"] },
          netAbsorption: {
            calculation: "Physical Absorption - Sublease Space Added (Economic Absorption)",
            leadingIndicators: ["Corporate return-to-office mandates", "Financial services hiring", "Flight to quality"],
            typical: "Positive for A+, negative for B/C",
            driverFormula: "WFH has structurally reduced space/employee by 15-30%; flight to quality benefits A+"
          },
          sensitivity: {
            supplyShock: { scenario: "+10% supply", occupancyImpact: "-400 to -700 bps", rentGrowthImpact: "-800 to -1200 bps", noiImpact: "-12% to -20%", timeToReversion: "36-60 months" },
            demandSurge: { scenario: "+20% absorption (RTO mandates)", occupancyImpact: "+150 to +300 bps (only trophy benefits)", rentGrowthImpact: "+300 to +500 bps", noiImpact: "+4% to +8% (only for A+)", timeToReversion: "24-36 months" }
          },
          developmentEconomics: {
            yieldOnCost: "6.5-8.5% (150-300 bps spread for trophy assets)",
            costPerSF: "$400-$800/SF (trophy CBD)",
            structuralAdvantage: "NONE currently. Long timeline is LIABILITY. Only trophy, pre-leased developments pencil. Avoid commodity office entirely."
          }
        }
      ]
    },
    {
      parentSector: "Towers",
      parentIcon: <Radio className="text-indigo-400" size={20} />,
      subsectors: [
        {
          name: "Cell Towers",
          icon: <Radio className="text-indigo-400" size={18} />,
          timeline: "6-9 months",
          criticalPath: "Zoning approval (NIMBY battles) + FAA clearance",
          marketBalance: "SUPPLY_CONSTRAINED" as const,
          supplyPipeline: { underConstruction: 1.8, permitted: 2.3, proposed: 4.1, keyConstraints: ["Local zoning (NIMBY is fierce)", "FAA flight path clearance", "Ground lease negotiations"] },
          netAbsorption: {
            calculation: "New tenant amendments (adding 2nd/3rd/4th carrier to existing tower)",
            leadingIndicators: ["Carrier capex guidance", "5G/6G densification", "Spectrum auctions", "Mobile data consumption growth"],
            typical: "8,000-12,000 new amendments quarterly (industry-wide)",
            driverFormula: "2x increase in mobile data = 20-30% more equipment per tower"
          },
          sensitivity: {
            supplyShock: { scenario: "+10% new tower supply (extremely difficult)", occupancyImpact: "-50 to -100 bps", rentGrowthImpact: "-100 to -200 bps", noiImpact: "-1% to -3%", timeToReversion: "6-12 months" },
            demandSurge: { scenario: "+20% amendment activity (5G/6G wave)", occupancyImpact: "N/A (amendments, not occupancy)", rentGrowthImpact: "+300 to +600 bps", noiImpact: "+15% to +25% (incremental amendments are pure profit)", timeToReversion: "Permanent (data consumption is secular)" }
          },
          developmentEconomics: {
            yieldOnCost: "9.0-12.0% (300-500 bps over market cap rate)",
            costPerSF: "$150K-$300K per tower",
            structuralAdvantage: "ULTIMATE MOAT. Zoning makes new towers nearly impossible. Amendment revenue (adding 2nd/3rd carrier) is 95%+ margin. Carrier lock-in creates pricing power. This is infrastructure, not real estate."
          }
        }
      ]
    },
    {
      parentSector: "Self-Storage",
      parentIcon: <Warehouse className="text-cyan-400" size={20} />,
      subsectors: [
        {
          name: "Self-Storage",
          icon: <Warehouse className="text-cyan-400" size={18} />,
          timeline: "8-12 months",
          criticalPath: "Site visibility & local market saturation analysis",
          marketBalance: "BALANCED" as const,
          supplyPipeline: { underConstruction: 3.5, permitted: 2.8, proposed: 4.2, keyConstraints: ["3-mile radius saturation", "Visibility from main roads", "Local demand density"] },
          netAbsorption: {
            calculation: "Net Occupied Units: Move-ins - Move-outs (track by unit size: 5x5, 10x10, etc.)",
            leadingIndicators: ["Housing turnover", "Divorce rates", "Small business formations", "Local population growth"],
            typical: "Stabilization takes 24-36 months; lease-up curve is slow but predictable",
            driverFormula: "Life transitions drive 60%+ of demand; recession-resistant (people downsize)"
          },
          sensitivity: {
            supplyShock: { scenario: "+10% supply (very painful in local markets)", occupancyImpact: "-400 to -600 bps", rentGrowthImpact: "-600 to -900 bps", noiImpact: "-10% to -15%", timeToReversion: "24-36 months" },
            demandSurge: { scenario: "+20% absorption (housing boom + population growth)", occupancyImpact: "+200 to +350 bps", rentGrowthImpact: "+600 to +1000 bps", noiImpact: "+12% to +20% (incremental revenue is 80%+ margin)", timeToReversion: "12-18 months" }
          },
          developmentEconomics: {
            yieldOnCost: "8.0-10.0% (250-400 bps spread)",
            costPerSF: "$40-$80/SF (low-cost construction)",
            structuralAdvantage: "EXTREME operating leverage (70-75% NOI margins). Revenue management allows daily pricing. Defensive demand. But local oversupply risk is real—track 3-mile radius supply carefully."
          }
        }
      ]
    },
    {
      parentSector: "Healthcare",
      parentIcon: <Heart className="text-pink-400" size={20} />,
      subsectors: [
        {
          name: "Senior Housing (IL/AL)",
          icon: <Heart className="text-pink-300" size={18} />,
          timeline: "18-24 months",
          criticalPath: "Certificate of Need (CON) approval + healthcare zoning",
          marketBalance: "SUPPLY_CONSTRAINED" as const,
          supplyPipeline: { underConstruction: 2.8, permitted: 1.2, proposed: 2.5, keyConstraints: ["CON laws in ~35 states", "Healthcare zoning restrictions", "Labor (caregiver ratios)", "Reimbursement risk"] },
          netAbsorption: {
            calculation: "(New 80+ Pop × 15% IL Penetration + 8% AL Penetration) - (Deaths × 0.6 occupancy lag)",
            leadingIndicators: ["80+ population growth (3-4% annually)", "Wealth transfer & home equity", "Medicare Advantage enrollment", "Caregiver wage trends"],
            typical: "Demographic-driven, 3-4% annual demand growth",
            driverFormula: "Baby boomers entering 75-80 age band create wave starting 2027-2030"
          },
          sensitivity: {
            supplyShock: { scenario: "+5% new supply (rare, CON-limited)", occupancyImpact: "-300 to -500 bps", rentGrowthImpact: "-200 to -400 bps", noiImpact: "-8% to -15%", timeToReversion: "18-24 months" },
            demandSurge: { scenario: "+10% absorption (wealth shock or home price spike)", occupancyImpact: "+200 to +400 bps", rentGrowthImpact: "+400 to +700 bps", noiImpact: "+10% to +18%", timeToReversion: "12-18 months" }
          },
          developmentEconomics: {
            yieldOnCost: "7.5-9.5% (200-400 bps spread to stabilized cap rates)",
            costPerSF: "$200-$350/unit per month (priced per unit, not per SF)",
            structuralAdvantage: "CON protection creates local monopolies. Demographic demand is non-cyclical and accelerating. But labor risk (caregiver wages) and reimbursement (Medicaid mix) create volatility."
          }
        },
        {
          name: "Medical Office Buildings (MOBs)",
          icon: <Stethoscope className="text-pink-400" size={18} />,
          timeline: "15-20 months",
          criticalPath: "Hospital affiliation agreement + proximity to medical cluster",
          marketBalance: "BALANCED" as const,
          supplyPipeline: { underConstruction: 1.8, permitted: 0.9, proposed: 1.5, keyConstraints: ["Hospital/medical cluster proximity", "High TI costs ($80-$150/SF)", "Hospital affiliation complexity"] },
          netAbsorption: {
            calculation: "(Healthcare Employment Growth × 200 SF/worker) + (Outpatient Volume Growth × 150 SF/1000 visits) - Obsolescence",
            leadingIndicators: ["Healthcare spending as % of GDP", "Hospital affiliation trends", "Outpatient shift acceleration", "Insurance coverage expansion"],
            typical: "Steady, non-discretionary demand growth",
            driverFormula: "Healthcare spending at 18% of GDP and rising; outpatient shift = structural tailwind for MOBs"
          },
          sensitivity: {
            supplyShock: { scenario: "+8% new supply (ASC wave or off-campus development)", occupancyImpact: "-200 to -400 bps", rentGrowthImpact: "-150 to -300 bps", noiImpact: "-5% to -10%", timeToReversion: "24-36 months" },
            demandSurge: { scenario: "+15% absorption (aging demographics + insurance expansion)", occupancyImpact: "+100 to +200 bps", rentGrowthImpact: "+200 to +400 bps", noiImpact: "+6% to +12%", timeToReversion: "18-24 months" }
          },
          developmentEconomics: {
            yieldOnCost: "6.5-8.0% (100-200 bps spread)",
            costPerSF: "$250-$400/SF (high TI costs for medical build-out)",
            structuralAdvantage: "Non-discretionary demand. Long-term leases (7-10 years). Hospital affiliation creates stickiness. Reimbursement policy risk is the key concern."
          }
        },
        {
          name: "Life Science / Lab Space",
          icon: <Microscope className="text-cyan-400" size={18} />,
          timeline: "18-30 months",
          criticalPath: "Specialized infrastructure (HVAC, vivarium, clean rooms) + cluster location",
          marketBalance: "OVERSUPPLY_RISK" as const,
          supplyPipeline: { underConstruction: 12.5, permitted: 8.0, proposed: 15.0, keyConstraints: ["Specialized HVAC/clean rooms", "University/hospital cluster proximity", "Bespoke tenant fit-out ($200-$500/SF TI)", "VC funding dependency"] },
          netAbsorption: {
            calculation: "(VC Funding ÷ $500K per employee × 300 SF per employee) + Pharma Expansion - Tenant Failures",
            leadingIndicators: ["Biotech VC funding levels", "Pharma R&D spend", "FDA approval pipeline", "University cluster proximity (Cambridge, SSF, San Diego)"],
            typical: "Highly cyclical; tied to VC funding cycles",
            driverFormula: "VC funding collapse 2022-2023 created 15-20% vacancy in secondary markets; clusters still tight"
          },
          sensitivity: {
            supplyShock: { scenario: "+20% new supply (pipeline delivering into weak demand)", occupancyImpact: "-800 to -1500 bps", rentGrowthImpact: "-1000 to -2000 bps", noiImpact: "-25% to -45%", timeToReversion: "36-48 months" },
            demandSurge: { scenario: "+30% absorption (biotech boom, FDA approvals, M&A wave)", occupancyImpact: "+500 to +1000 bps", rentGrowthImpact: "+1500 to +3000 bps", noiImpact: "+30% to +60%", timeToReversion: "12-24 months" }
          },
          developmentEconomics: {
            yieldOnCost: "6.0-8.5% upcycle, 4.0-5.5% downcycle",
            costPerSF: "$600-$1,200/SF (most expensive CRE to build)",
            structuralAdvantage: "Cluster network effects create moats in top-tier markets. Extreme cyclicality and tenant credit risk. VC-driven boom-bust asset class."
          }
        },
        {
          name: "Skilled Nursing Facilities (SNFs)",
          icon: <Activity className="text-pink-500" size={18} />,
          timeline: "12-18 months",
          criticalPath: "CON approval + Medicaid/Medicare certification",
          marketBalance: "SUPPLY_CONSTRAINED" as const,
          supplyPipeline: { underConstruction: 0.8, permitted: 0.4, proposed: 0.9, keyConstraints: ["CON restrictions in most states", "Medicaid/Medicare certification", "Operator credit risk", "Labor cost sensitivity"] },
          netAbsorption: {
            calculation: "(Hospital Discharges × 15% SNF Utilization) + (Chronic Care Need Growth) - Home Health Substitution",
            leadingIndicators: ["Medicare/Medicaid reimbursement rates", "80+ population growth", "Post-acute care demand", "Home health substitution trends"],
            typical: "Supply frozen for a decade; demand rising with aging population",
            driverFormula: "REIT performance depends on operator health, not demand. Reimbursement cuts can bankrupt operators even as demand is strong."
          },
          sensitivity: {
            supplyShock: { scenario: "+3% new supply (rare, CON-limited)", occupancyImpact: "-100 to -200 bps", rentGrowthImpact: "0 to -100 bps", noiImpact: "-2% to -5%", timeToReversion: "12-18 months" },
            demandSurge: { scenario: "+10% absorption (aging wave or Medicare Advantage growth)", occupancyImpact: "+50 to +150 bps", rentGrowthImpact: "+100 to +300 bps", noiImpact: "+3% to +8%", timeToReversion: "N/A (structural demand)" }
          },
          developmentEconomics: {
            yieldOnCost: "8.5-10.5% (high yields due to operator risk)",
            costPerSF: "$150-$250/SF",
            structuralAdvantage: "Triple-net structure insulates REIT. CON protection limits competition. Track operator coverage ratios (EBITDAR ÷ Rent)—1.2x minimum, 1.5x+ safe."
          }
        },
        {
          name: "Hospitals (Acute Care)",
          icon: <Heart className="text-rose-500" size={18} />,
          timeline: "36-48 months",
          criticalPath: "CON approval (12-24mo) + CMS certification + extreme capital intensity",
          marketBalance: "CRITICAL_SHORTAGE" as const,
          supplyPipeline: { underConstruction: 0.3, permitted: 0.2, proposed: 0.5, keyConstraints: ["CON laws (36 states)", "Capital intensity ($1M-$2M per bed)", "State health dept approval", "CMS certification process"] },
          netAbsorption: {
            calculation: "(Population Growth × Hospital Bed Utilization) + (Aging Demographics × Acuity Mix Shift) - Outpatient Migration",
            leadingIndicators: ["Population growth", "Aging demographics", "CON law changes", "Hospital system M&A activity"],
            typical: "Construction essentially frozen; existing hospitals are local monopolies (70-85% market share)",
            driverFormula: "Non-discretionary demand growing with aging population. Most REIT exposure via sale-leaseback with HCA, Tenet, CHS."
          },
          sensitivity: {
            supplyShock: { scenario: "+2% new supply (extremely rare)", occupancyImpact: "-50 to -150 bps", rentGrowthImpact: "0 to -50 bps", noiImpact: "-1% to -3%", timeToReversion: "N/A (structural monopolies)" },
            demandSurge: { scenario: "+5% absorption (pandemic or Medicaid expansion)", occupancyImpact: "+20 to +50 bps", rentGrowthImpact: "+50 to +150 bps", noiImpact: "+1% to +4%", timeToReversion: "N/A (structural demand)" }
          },
          developmentEconomics: {
            yieldOnCost: "7.5-9.5% (high yields due to operator risk and capital intensity)",
            costPerSF: "$400-$800/SF or $1M-$2M per bed",
            structuralAdvantage: "CON monopolies create unassailable moats. Triple-net leases (15-20yr) with investment-grade tenants. Track coverage ratios—1.5x+ safe, below 1.2x is distress."
          }
        }
      ]
    }
  ];

  const getBalanceColor = (balance: string) => {
    switch (balance) {
      case 'OVERSUPPLY_RISK': return 'text-rose-400';
      case 'BALANCED': return 'text-gold';
      case 'SUPPLY_CONSTRAINED': return 'text-emerald-400';
      case 'CRITICAL_SHORTAGE': return 'text-cyan-400';
      default: return 'text-slate-400';
    }
  };

  const getBalanceIcon = (balance: string) => {
    switch (balance) {
      case 'OVERSUPPLY_RISK': return <AlertTriangle size={16} />;
      case 'BALANCED': return <Activity size={16} />;
      case 'SUPPLY_CONSTRAINED': return <TrendingUp size={16} />;
      case 'CRITICAL_SHORTAGE': return <Zap size={16} />;
      default: return <Target size={16} />;
    }
  };

  // Get all subsectors or filtered by parent
  const getVisibleSubsectors = () => {
    if (!selectedParentSector) {
      // Show all subsectors grouped by parent
      return supplyDemandMetrics;
    }
    // Show only selected parent's subsectors
    return supplyDemandMetrics.filter(p => p.parentSector === selectedParentSector);
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 pb-20">
      <header className="aegis-card p-10 gold-braiding relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <BookOpen size={120} />
        </div>
        <div className="relative z-10">
          <h2 className="header-institutional text-3xl font-black text-white uppercase tracking-tighter">The Specialist's Handbook</h2>
          <p className="text-xs text-rain uppercase tracking-[0.4em] mt-3">Mastering Subsector Supply/Demand Dynamics & Net Absorption Logic</p>
          <div className="mt-8 flex gap-4 flex-wrap">
             <span className="px-3 py-1 bg-gold/10 border border-gold/20 rounded text-[9px] font-black text-gold uppercase tracking-widest">v5.0 MD Series</span>
             <span className="px-3 py-1 bg-lightBlue/10 border border-lightBlue/20 rounded text-[9px] font-black text-lightBlue uppercase tracking-widest">Subsector Granularity</span>
             <span className="px-3 py-1 bg-pumpkin/10 border border-pumpkin/20 rounded text-[9px] font-black text-pumpkin uppercase tracking-widest">S/D Analytics</span>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="flex gap-3 bg-obsidian/60 p-2 rounded-lg border border-royal/10 flex-wrap">
        {[
          { id: 'fundamentals', label: 'Fundamentals', icon: BarChart3 },
          { id: 'sectors', label: 'Sector Nuance', icon: Target },
          { id: 'supply-demand', label: 'Supply/Demand', icon: Activity },
          { id: 'development', label: 'Development Risk', icon: Construction }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${
              activeTab === tab.id
                ? 'bg-gold/20 border border-gold/30 text-gold'
                : 'border border-transparent text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Fundamentals Section */}
      {activeTab === 'fundamentals' && (
        <section className="space-y-8">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <BarChart3 className="text-gold" size={24} />
            <h3 className="header-noe text-xl text-white">REIT Fundamentals & Misconceptions</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {fundamentals.map((f, i) => (
              <div key={i} className="aegis-card p-8 flex flex-col justify-between group hover:border-gold/30 transition-all">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    {f.icon}
                    <h4 className="text-sm font-black text-white uppercase tracking-widest">{f.title}</h4>
                  </div>
                  <div className="space-y-6">
                    <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded">
                      <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest block mb-2">Common Myth</span>
                      <p className="text-[11px] text-slate-400 italic leading-relaxed">"{f.myth}"</p>
                    </div>
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded">
                      <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest block mb-2">The Reality</span>
                      <p className="text-[11px] text-slate-200 leading-relaxed font-medium">{f.reality}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-8 pt-6 border-t border-white/5">
                  <span className="text-[9px] font-black text-gold uppercase tracking-widest block mb-2">Specialist Rule of Thumb</span>
                  <p className="text-[10px] text-slate-400 font-bold leading-tight">{f.stat}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sector Nuances Section */}
      {activeTab === 'sectors' && (
        <section className="space-y-8">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <Target className="text-pumpkin" size={24} />
            <h3 className="header-noe text-xl text-white">Sector Nuance: What Really Matters</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {sectorNuances.map((s, i) => (
              <div key={i} className="aegis-card p-6 bg-darkBlue/20 border-white/5 hover:bg-darkBlue/30 transition-all">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    {s.icon}
                    <h4 className="text-xs font-black text-white uppercase tracking-widest">{s.sector}</h4>
                  </div>
                  <div className="w-8 h-px bg-white/10"></div>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="text-[8px] font-black text-rain uppercase tracking-widest block mb-1">Primary Alpha Driver</span>
                    <span className="text-[10px] font-bold text-white">{s.driver}</span>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    {s.insight}
                  </p>

                  <div className="p-3 bg-white/5 rounded border border-white/5 flex items-start gap-2">
                    <TrendingUp className="text-gold shrink-0 mt-0.5" size={12} />
                    <div>
                      <span className="text-[8px] font-black text-gold uppercase tracking-widest block mb-1">Sensitivity Metric</span>
                      <p className="text-[9px] text-slate-300 font-medium leading-tight">{s.rule}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Supply/Demand Section with SUBSECTOR SELECTOR */}
      {activeTab === 'supply-demand' && (
        <section className="space-y-8">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <Activity className="text-pumpkin" size={24} />
            <h3 className="header-noe text-xl text-white">Supply/Demand Dynamics & Net Absorption (Subsector Level)</h3>
          </div>

          <div className="aegis-card p-8 bg-lightBlue/5 border-lightBlue/20">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="text-lightBlue shrink-0 mt-1" size={20} />
              <div className="space-y-2">
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Analyst Framework (Subsector Granularity)</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  SUBSECTOR analysis is critical. "Industrial" masks the difference between last-mile (strong) vs. bulk (commodity).
                  "Retail" hides grocery-anchored (resilient) vs. malls (distressed). "Lodging" combines extended stay (defensive) with full-service (cyclical).
                  Use the sector filters below to drill into subsector S/D dynamics.
                </p>
              </div>
            </div>
          </div>

          {/* Parent Sector Filter */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setSelectedParentSector(null)}
              className={`px-4 py-2 rounded border transition-all ${
                !selectedParentSector
                  ? 'bg-gold/20 border-gold/30 text-gold'
                  : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-widest">All Sectors</span>
            </button>
            {supplyDemandMetrics.map((parent, i) => (
              <button
                key={i}
                onClick={() => setSelectedParentSector(parent.parentSector)}
                className={`flex items-center gap-2 px-4 py-2 rounded border transition-all ${
                  selectedParentSector === parent.parentSector
                    ? 'bg-pumpkin/20 border-pumpkin/30 text-pumpkin'
                    : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {parent.parentIcon}
                <span className="text-[10px] font-black uppercase tracking-widest">{parent.parentSector}</span>
              </button>
            ))}
          </div>

          <div className="space-y-10">
            {getVisibleSubsectors().map((parent, parentIdx) => (
              <div key={parentIdx} className="space-y-6">
                {/* Parent Sector Header */}
                <div className="flex items-center gap-3 pb-2 border-b border-pumpkin/20">
                  {parent.parentIcon}
                  <h4 className="text-lg font-black text-white uppercase tracking-wider">{parent.parentSector}</h4>
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest">({parent.subsectors.length} subsectors)</span>
                </div>

                {/* Subsectors */}
                {parent.subsectors.map((subsector, subIdx) => (
                  <div key={subIdx} className="aegis-card p-8 bg-darkBlue/20 border-white/5">
                    {/* Subsector Header */}
                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5 flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        {subsector.icon}
                        <div>
                          <h4 className="text-sm font-black text-white uppercase tracking-widest">{subsector.name}</h4>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[9px] text-slate-400 uppercase tracking-wider">Greenfield → Delivery:</span>
                            <span className="text-[10px] font-black text-pumpkin">{subsector.timeline}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded border ${
                        subsector.marketBalance === 'OVERSUPPLY_RISK' ? 'bg-rose-500/10 border-rose-500/20' :
                        subsector.marketBalance === 'SUPPLY_CONSTRAINED' ? 'bg-emerald-500/10 border-emerald-500/20' :
                        'bg-gold/10 border-gold/20'
                      }`}>
                        <span className={getBalanceColor(subsector.marketBalance)}>
                          {getBalanceIcon(subsector.marketBalance)}
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${getBalanceColor(subsector.marketBalance)}`}>
                          {subsector.marketBalance.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Three Column Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Supply Pipeline */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                          <Boxes className="text-gold" size={16} />
                          <span className="text-[9px] font-black text-gold uppercase tracking-widest">Supply Pipeline</span>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-400">Under Construction</span>
                            <span className="text-[11px] font-black text-white">{subsector.supplyPipeline.underConstruction}%</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-400">Permitted</span>
                            <span className="text-[11px] font-black text-white">{subsector.supplyPipeline.permitted}%</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-400">Proposed</span>
                            <span className="text-[11px] font-black text-white">{subsector.supplyPipeline.proposed}%</span>
                          </div>
                        </div>
                        <div className="pt-4 mt-4 border-t border-white/5">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-2">Critical Path</span>
                          <p className="text-[10px] text-pumpkin font-bold">{subsector.criticalPath}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-2">Key Constraints</span>
                          {subsector.supplyPipeline.keyConstraints.map((c, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="text-slate-600 text-[10px] mt-0.5">•</span>
                              <span className="text-[9px] text-slate-400">{c}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Net Absorption */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                          <LineChart className="text-emerald-400" size={16} />
                          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Net Absorption</span>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-2">Calculation</span>
                            <p className="text-[10px] text-slate-300 font-mono bg-obsidian/50 p-2 rounded border border-white/5">
                              {subsector.netAbsorption.calculation}
                            </p>
                          </div>
                          <div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-2">Typical</span>
                            <p className="text-[10px] text-white font-bold">{subsector.netAbsorption.typical}</p>
                          </div>
                          <div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-2">Driver Formula</span>
                            <p className="text-[10px] text-lightBlue italic">{subsector.netAbsorption.driverFormula}</p>
                          </div>
                        </div>
                        <div className="pt-4 mt-4 border-t border-white/5">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-2">Leading Indicators</span>
                          {subsector.netAbsorption.leadingIndicators.map((ind, idx) => (
                            <div key={idx} className="flex items-start gap-2 mt-1">
                              <TrendingUp className="text-emerald-500 shrink-0 mt-0.5" size={10} />
                              <span className="text-[9px] text-slate-400">{ind}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Sensitivity Analysis */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                          <BarChart3 className="text-rose-400" size={16} />
                          <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Sensitivity</span>
                        </div>

                        {/* Supply Shock */}
                        <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded">
                          <div className="flex items-center gap-2 mb-3">
                            <TrendingDown className="text-rose-400" size={12} />
                            <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">{subsector.sensitivity.supplyShock.scenario}</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-[8px] text-slate-500 uppercase tracking-wider">Occupancy</span>
                              <span className="text-[9px] font-bold text-rose-300">{subsector.sensitivity.supplyShock.occupancyImpact}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[8px] text-slate-500 uppercase tracking-wider">Rent Growth</span>
                              <span className="text-[9px] font-bold text-rose-300">{subsector.sensitivity.supplyShock.rentGrowthImpact}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[8px] text-slate-500 uppercase tracking-wider">NOI Impact</span>
                              <span className="text-[9px] font-bold text-rose-200">{subsector.sensitivity.supplyShock.noiImpact}</span>
                            </div>
                            <div className="pt-2 mt-2 border-t border-rose-500/10">
                              <span className="text-[8px] text-slate-500 uppercase tracking-wider block mb-1">Reversion</span>
                              <span className="text-[9px] text-slate-400 italic">{subsector.sensitivity.supplyShock.timeToReversion}</span>
                            </div>
                          </div>
                        </div>

                        {/* Demand Surge */}
                        <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded">
                          <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="text-emerald-400" size={12} />
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{subsector.sensitivity.demandSurge.scenario}</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-[8px] text-slate-500 uppercase tracking-wider">Occupancy</span>
                              <span className="text-[9px] font-bold text-emerald-300">{subsector.sensitivity.demandSurge.occupancyImpact}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[8px] text-slate-500 uppercase tracking-wider">Rent Growth</span>
                              <span className="text-[9px] font-bold text-emerald-300">{subsector.sensitivity.demandSurge.rentGrowthImpact}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[8px] text-slate-500 uppercase tracking-wider">NOI Impact</span>
                              <span className="text-[9px] font-bold text-emerald-200">{subsector.sensitivity.demandSurge.noiImpact}</span>
                            </div>
                            <div className="pt-2 mt-2 border-t border-emerald-500/10">
                              <span className="text-[8px] text-slate-500 uppercase tracking-wider block mb-1">Reversion</span>
                              <span className="text-[9px] text-slate-400 italic">{subsector.sensitivity.demandSurge.timeToReversion}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Development Economics Summary */}
                    <div className="mt-6 pt-6 border-t border-white/5">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Yield on Cost</span>
                          <p className="text-[10px] text-emerald-400 font-bold">{subsector.developmentEconomics.yieldOnCost}</p>
                        </div>
                        <div>
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Development Cost</span>
                          <p className="text-[10px] text-lightBlue font-bold">{subsector.developmentEconomics.costPerSF}</p>
                        </div>
                        <div className="md:col-span-1">
                          <span className="text-[8px] font-black text-gold uppercase tracking-widest block mb-1">Structural Advantage</span>
                          <p className="text-[9px] text-slate-300 italic leading-tight">{subsector.developmentEconomics.structuralAdvantage}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Development Economics Section */}
      {activeTab === 'development' && (
        <section className="space-y-8">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <Construction className="text-gold" size={24} />
            <h3 className="header-noe text-xl text-white">Development Economics & Delivery Risk (Subsector Level)</h3>
          </div>

          <div className="aegis-card p-8 bg-pumpkin/5 border-pumpkin/20">
            <div className="flex items-start gap-4">
              <Clock className="text-pumpkin shrink-0 mt-1" size={20} />
              <div className="space-y-2">
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Why Subsector Timeline = Subsector Moat</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  SUBSECTOR timelines vary dramatically. Last-mile industrial (9-12mo) has weaker moat than bulk warehouses due to faster supply response.
                  Extended-stay hotels (15-20mo) are more defensive than full-service (24-36mo) due to lower capex and faster development.
                  Manufactured housing (6-12mo for community) has MASSIVE moat despite short timeline because land is nearly impossible to zone.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {getVisibleSubsectors().map((parent, parentIdx) => (
              <div key={parentIdx} className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-pumpkin/20">
                  {parent.parentIcon}
                  <h4 className="text-lg font-black text-white uppercase tracking-wider">{parent.parentSector}</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {parent.subsectors.map((subsector, subIdx) => (
                    <div key={subIdx} className="aegis-card p-6 bg-darkBlue/20 border-white/5 hover:border-gold/20 transition-all">
                      <div className="flex items-center gap-3 mb-6">
                        {subsector.icon}
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-widest">{subsector.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="text-pumpkin" size={10} />
                            <span className="text-[9px] text-pumpkin font-bold">{subsector.timeline}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-2">Yield on Cost</span>
                          <p className="text-[10px] text-emerald-400 font-bold">{subsector.developmentEconomics.yieldOnCost}</p>
                        </div>

                        <div>
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-2">Development Cost</span>
                          <p className="text-[10px] text-lightBlue font-bold">{subsector.developmentEconomics.costPerSF}</p>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                          <span className="text-[8px] font-black text-gold uppercase tracking-widest block mb-2">Structural Advantage / Moat</span>
                          <p className="text-[10px] text-slate-300 leading-relaxed italic">{subsector.developmentEconomics.structuralAdvantage}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="p-10 bg-darkBlue/40 rounded-xl border border-white/5 text-center">
        <p className="text-[10px] text-slate-500 uppercase tracking-[0.5em] font-bold">
          Data curated from NAREIT, Green Street Advisors, ISI Evercore, CoStar, and CBRE Research.
        </p>
      </footer>
    </div>
  );
};

export default ExpertKnowledge;
