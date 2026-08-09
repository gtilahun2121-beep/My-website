// Profession-Based Equb Categories
export type EqubCategory = {
  id: string;
  name: string;
  profession: string;
  description: string;
  icon: string;
  incomeLevel: 'low' | 'medium' | 'high';
  monthlyPayment: number; // ETB
  expectedReturn: number; // ETB
  members: number;
  payoutFrequency: string;
  paymentCycle: {
    duration: number; // months
    description: string;
  };
  paymentMethods: {
    name: string;
    icon: string;
    description: string;
  }[];
};

export const equbCategories: EqubCategory[] = [
  {
    id: 'diaspora',
    name: 'Diaspora & Overseas Community Equb',
    profession: 'Diaspora Workers',
    description: 'For Ethiopians living and working abroad',
    icon: '✈️',
    incomeLevel: 'high',
    monthlyPayment: 5000,
    expectedReturn: 60000,
    members: 1250,
    payoutFrequency: 'Monthly',
    paymentCycle: { duration: 12, description: 'Annual cycle (12 months)' },
    paymentMethods: [
      { name: 'CBE Bank Transfer', icon: '🏦', description: 'Direct bank transfer via CBE' },
      { name: 'International Wire', icon: '🌐', description: 'Wire transfer from abroad' },
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
      { name: 'Cash Payment', icon: '💵', description: 'Direct cash payment' },
    ],
  },
  {
    id: 'teachers',
    name: 'Teachers & Academic Staff Equb',
    profession: 'Education Sector',
    description: 'For teachers, professors, and academic staff',
    icon: '📚',
    incomeLevel: 'medium',
    monthlyPayment: 1500,
    expectedReturn: 18000,
    members: 3400,
    payoutFrequency: 'Monthly',
    paymentCycle: { duration: 12, description: 'Annual cycle (12 months)' },
    paymentMethods: [
      { name: 'CBE Bank Transfer', icon: '🏦', description: 'Direct bank transfer via CBE' },
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
      { name: 'Cash Payment', icon: '💵', description: 'Direct cash payment' },
    ],
  },
  {
    id: 'taxi_drivers',
    name: 'Taxi & Minibus Drivers Equb',
    profession: 'Transportation',
    description: 'For taxi and minibus drivers',
    icon: '🚕',
    incomeLevel: 'medium',
    monthlyPayment: 1200,
    expectedReturn: 14400,
    members: 2850,
    payoutFrequency: 'Monthly',
    paymentCycle: { duration: 12, description: 'Annual cycle (12 months)' },
    paymentMethods: [
      { name: 'CBE Bank Transfer', icon: '🏦', description: 'Bank transfer via CBE' },
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
      { name: 'Cash Payment', icon: '💵', description: 'Direct cash payment' },
    ],
  },
  {
    id: 'civil_servants',
    name: 'Civil Servants & Government Workers Equb',
    profession: 'Government',
    description: 'For government employees and civil servants',
    icon: '🏛️',
    incomeLevel: 'medium',
    monthlyPayment: 2000,
    expectedReturn: 24000,
    members: 5600,
    payoutFrequency: 'Monthly',
    paymentCycle: { duration: 12, description: 'Annual cycle (12 months)' },
    paymentMethods: [
      { name: 'CBE Bank Transfer', icon: '🏦', description: 'Direct bank transfer via CBE' },
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
      { name: 'Cash Payment', icon: '💵', description: 'Direct cash payment' },
    ],
  },
  {
    id: 'bajaj_riders',
    name: 'Bajaj & Motorcycle Riders Equb',
    profession: 'Transportation',
    description: 'For bajaj and motorcycle taxi riders',
    icon: '🏍️',
    incomeLevel: 'low',
    monthlyPayment: 800,
    expectedReturn: 9600,
    members: 2100,
    payoutFrequency: 'Monthly',
    paymentCycle: { duration: 10, description: 'Extended cycle (10 months)' },
    paymentMethods: [
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
      { name: 'Cash Payment', icon: '💵', description: 'Direct cash payment' },
      { name: 'CBE Bank Transfer', icon: '🏦', description: 'Bank transfer if available' },
    ],
  },
  {
    id: 'market_vendors',
    name: 'Market Vendors & Retailers Equb',
    profession: 'Retail & Commerce',
    description: 'For market vendors and small retailers',
    icon: '🛒',
    incomeLevel: 'low',
    monthlyPayment: 1000,
    expectedReturn: 12000,
    members: 4200,
    payoutFrequency: 'Monthly',
    paymentCycle: { duration: 12, description: 'Annual cycle (12 months)' },
    paymentMethods: [
      { name: 'Cash Payment', icon: '💵', description: 'Direct cash payment' },
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
      { name: 'CBE Bank Transfer', icon: '🏦', description: 'Bank transfer if available' },
    ],
  },
  {
    id: 'healthcare',
    name: 'Healthcare Professionals Equb',
    profession: 'Healthcare',
    description: 'For doctors, nurses, and healthcare workers',
    icon: '⚕️',
    incomeLevel: 'high',
    monthlyPayment: 3000,
    expectedReturn: 36000,
    members: 1800,
    payoutFrequency: 'Monthly',
    paymentCycle: { duration: 12, description: 'Annual cycle (12 months)' },
    paymentMethods: [
      { name: 'CBE Bank Transfer', icon: '🏦', description: 'Direct bank transfer via CBE' },
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
      { name: 'Cash Payment', icon: '💵', description: 'Direct cash payment' },
    ],
  },
  {
    id: 'bankers',
    name: 'Bankers & Financial Sector Staff Equb',
    profession: 'Finance',
    description: 'For bank employees and financial professionals',
    icon: '🏦',
    incomeLevel: 'high',
    monthlyPayment: 3500,
    expectedReturn: 42000,
    members: 1200,
    payoutFrequency: 'Monthly',
    paymentCycle: { duration: 12, description: 'Annual cycle (12 months)' },
    paymentMethods: [
      { name: 'CBE Bank Transfer', icon: '🏦', description: 'Direct bank transfer via CBE' },
      { name: 'Internal Bank Transfer', icon: '💳', description: 'Internal bank transfers' },
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
    ],
  },
  {
    id: 'wholesale_merchants',
    name: 'Wholesale Merchants & Importers Equb',
    profession: 'Business & Trade',
    description: 'For wholesale traders and importers',
    icon: '📦',
    incomeLevel: 'high',
    monthlyPayment: 4000,
    expectedReturn: 48000,
    members: 890,
    payoutFrequency: 'Monthly',
    paymentCycle: { duration: 12, description: 'Annual cycle (12 months)' },
    paymentMethods: [
      { name: 'CBE Bank Transfer', icon: '🏦', description: 'Direct bank transfer via CBE' },
      { name: 'Other Banks', icon: '🏦', description: 'Transfer via other Ethiopian banks' },
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
    ],
  },
  {
    id: 'tailors',
    name: 'Tailors & Garment Creators Equb',
    profession: 'Fashion & Textiles',
    description: 'For tailors and garment producers',
    icon: '👗',
    incomeLevel: 'low',
    monthlyPayment: 900,
    expectedReturn: 10800,
    members: 1600,
    payoutFrequency: 'Monthly',
    paymentCycle: { duration: 12, description: 'Annual cycle (12 months)' },
    paymentMethods: [
      { name: 'Cash Payment', icon: '💵', description: 'Direct cash payment' },
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
      { name: 'CBE Bank Transfer', icon: '🏦', description: 'Bank transfer if available' },
    ],
  },
  {
    id: 'mechanics',
    name: 'Mechanics & Garage Owners Equb',
    profession: 'Automotive',
    description: 'For mechanics and garage owners',
    icon: '🔧',
    incomeLevel: 'medium',
    monthlyPayment: 1800,
    expectedReturn: 21600,
    members: 2300,
    payoutFrequency: 'Monthly',
    paymentCycle: { duration: 12, description: 'Annual cycle (12 months)' },
    paymentMethods: [
      { name: 'CBE Bank Transfer', icon: '🏦', description: 'Bank transfer via CBE' },
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
      { name: 'Cash Payment', icon: '💵', description: 'Direct cash payment' },
    ],
  },
  {
    id: 'barbers',
    name: 'Barbers & Beauty Salon Operators Equb',
    profession: 'Beauty & Personal Care',
    description: 'For barbers and beauty salon owners',
    icon: '💇',
    incomeLevel: 'low',
    monthlyPayment: 850,
    expectedReturn: 10200,
    members: 1900,
    payoutFrequency: 'Monthly',
    paymentCycle: { duration: 10, description: 'Extended cycle (10 months)' },
    paymentMethods: [
      { name: 'Cash Payment', icon: '💵', description: 'Direct cash payment' },
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
    ],
  },
  {
    id: 'construction',
    name: 'Construction Workers & Carpenters Equb',
    profession: 'Construction',
    description: 'For construction workers and carpenters',
    icon: '🏗️',
    incomeLevel: 'medium',
    monthlyPayment: 1400,
    expectedReturn: 16800,
    members: 2700,
    payoutFrequency: 'Monthly',
    paymentCycle: { duration: 12, description: 'Annual cycle (12 months)' },
    paymentMethods: [
      { name: 'Cash Payment', icon: '💵', description: 'Direct cash payment' },
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
      { name: 'CBE Bank Transfer', icon: '🏦', description: 'Bank transfer if available' },
    ],
  },
  {
    id: 'truck_drivers',
    name: 'Freight & Truck Drivers Equb',
    profession: 'Transportation & Logistics',
    description: 'For truck and freight drivers',
    icon: '🚚',
    incomeLevel: 'medium',
    monthlyPayment: 1600,
    expectedReturn: 19200,
    members: 2200,
    payoutFrequency: 'Monthly',
    paymentCycle: { duration: 12, description: 'Annual cycle (12 months)' },
    paymentMethods: [
      { name: 'CBE Bank Transfer', icon: '🏦', description: 'Bank transfer via CBE' },
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
      { name: 'Cash Payment', icon: '💵', description: 'Direct cash payment' },
    ],
  },
  {
    id: 'ngo_corporate',
    name: 'NGO & Corporate Employees Equb',
    profession: 'Corporate & Non-Profit',
    description: 'For NGO and corporate sector employees',
    icon: '💼',
    incomeLevel: 'high',
    monthlyPayment: 2500,
    expectedReturn: 30000,
    members: 3100,
    payoutFrequency: 'Monthly',
    paymentCycle: { duration: 12, description: 'Annual cycle (12 months)' },
    paymentMethods: [
      { name: 'CBE Bank Transfer', icon: '🏦', description: 'Direct bank transfer via CBE' },
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
      { name: 'Cash Payment', icon: '💵', description: 'Direct cash payment' },
    ],
  },
  {
    id: 'farmers',
    name: 'Farmers & Agricultural Suppliers Equb',
    profession: 'Agriculture',
    description: 'For farmers and agricultural suppliers',
    icon: '🌾',
    incomeLevel: 'low',
    monthlyPayment: 700,
    expectedReturn: 8400,
    members: 3800,
    payoutFrequency: 'Seasonal',
    paymentCycle: { duration: 8, description: 'Seasonal cycle (8 months)' },
    paymentMethods: [
      { name: 'Cash Payment', icon: '💵', description: 'Direct cash payment' },
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
    ],
  },
  {
    id: 'real_estate',
    name: 'Real Estate & Contractors Equb',
    profession: 'Real Estate & Development',
    description: 'For real estate agents and construction contractors',
    icon: '🏢',
    incomeLevel: 'high',
    monthlyPayment: 4500,
    expectedReturn: 54000,
    members: 650,
    payoutFrequency: 'Monthly',
    paymentCycle: { duration: 12, description: 'Annual cycle (12 months)' },
    paymentMethods: [
      { name: 'CBE Bank Transfer', icon: '🏦', description: 'Direct bank transfer via CBE' },
      { name: 'Other Banks', icon: '🏦', description: 'Transfer via other Ethiopian banks' },
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
    ],
  },
  {
    id: 'tech_freelancers',
    name: 'Tech & Digital Freelancers Equb',
    profession: 'Technology & Digital',
    description: 'For tech professionals and digital freelancers',
    icon: '💻',
    incomeLevel: 'high',
    monthlyPayment: 3200,
    expectedReturn: 38400,
    members: 950,
    payoutFrequency: 'Monthly',
    paymentCycle: { duration: 12, description: 'Annual cycle (12 months)' },
    paymentMethods: [
      { name: 'CBE Bank Transfer', icon: '🏦', description: 'Direct bank transfer via CBE' },
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
      { name: 'International Wire', icon: '🌐', description: 'Wire transfer capability' },
    ],
  },
  {
    id: 'cafe_restaurant',
    name: 'Cafe, Bar & Restaurant Staff Equb',
    profession: 'Hospitality & Food Service',
    description: 'For cafe, bar, and restaurant workers and owners',
    icon: '☕',
    incomeLevel: 'low',
    monthlyPayment: 1100,
    expectedReturn: 13200,
    members: 2600,
    payoutFrequency: 'Monthly',
    paymentCycle: { duration: 12, description: 'Annual cycle (12 months)' },
    paymentMethods: [
      { name: 'Cash Payment', icon: '💵', description: 'Direct cash payment' },
      { name: 'Mobile Money', icon: '📱', description: 'Telebirr or Zagel payment' },
      { name: 'CBE Bank Transfer', icon: '🏦', description: 'Bank transfer if available' },
    ],
  },
];

// Get equb by income level
export function getEqubByIncomeLevel(level: 'low' | 'medium' | 'high'): EqubCategory[] {
  return equbCategories.filter((equb) => equb.incomeLevel === level);
}

// Get all professions
export function getAllProfessions(): string[] {
  return [...new Set(equbCategories.map((equb) => equb.profession))];
}

// Get equb by profession
export function getEqubByProfession(profession: string): EqubCategory[] {
  return equbCategories.filter((equb) => equb.profession === profession);
}

// Get total members
export function getTotalMembers(): number {
  return equbCategories.reduce((total, equb) => total + equb.members, 0);
}
