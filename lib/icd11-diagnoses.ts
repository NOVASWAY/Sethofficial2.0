// ICD-11 Diagnosis Database with Common Conditions
// This provides autocomplete suggestions for doctors

export interface Diagnosis {
  code: string
  name: string
  category: string
  keywords: string[]
  common: boolean
}

// Comprehensive ICD-11 diagnosis database
export const icd11Diagnoses: Diagnosis[] = [
  // INFECTIOUS DISEASES
  {
    code: "1F40.0",
    name: "Malaria, Uncomplicated",
    category: "Infectious",
    keywords: ["malaria", "fever", "chills", "plasmodium", "parasite"],
    common: true
  },
  {
    code: "1F40.1",
    name: "Severe Malaria",
    category: "Infectious",
    keywords: ["malaria", "severe", "cerebral", "complicated"],
    common: true
  },
  {
    code: "1C62.Z",
    name: "Typhoid Fever",
    category: "Infectious",
    keywords: ["typhoid", "salmonella", "enteric fever"],
    common: true
  },
  {
    code: "CA40.Z",
    name: "Upper Respiratory Tract Infection (URTI)",
    category: "Infectious",
    keywords: ["urti", "cold", "flu", "cough", "sore throat", "runny nose"],
    common: true
  },
  {
    code: "CA40.0",
    name: "Common Cold",
    category: "Infectious",
    keywords: ["cold", "rhinitis", "runny nose", "nasal congestion"],
    common: true
  },
  {
    code: "DA04.0",
    name: "Pneumonia, Bacterial",
    category: "Infectious",
    keywords: ["pneumonia", "chest infection", "lung infection", "cough"],
    common: true
  },
  {
    code: "1A20",
    name: "Tuberculosis of Respiratory System",
    category: "Infectious",
    keywords: ["tb", "tuberculosis", "chest tb", "lung tb", "cough"],
    common: true
  },
  {
    code: "1F03.Z",
    name: "Gastroenteritis, Infectious",
    category: "Infectious",
    keywords: ["diarrhea", "vomiting", "stomach flu", "food poisoning", "gastro"],
    common: true
  },
  {
    code: "1C1Z",
    name: "HIV Disease",
    category: "Infectious",
    keywords: ["hiv", "aids", "retrovirus"],
    common: false
  },
  {
    code: "1F00.0",
    name: "Urinary Tract Infection (UTI)",
    category: "Infectious",
    keywords: ["uti", "urinary", "bladder infection", "cystitis", "dysuria"],
    common: true
  },

  // FEVER CONDITIONS
  {
    code: "MG26",
    name: "Fever, Unspecified",
    category: "Symptoms",
    keywords: ["fever", "pyrexia", "high temperature", "febrile"],
    common: true
  },
  {
    code: "1D10",
    name: "Viral Fever",
    category: "Infectious",
    keywords: ["viral fever", "fever", "viral illness"],
    common: true
  },

  // CARDIOVASCULAR
  {
    code: "BA00",
    name: "Essential Hypertension",
    category: "Cardiovascular",
    keywords: ["hypertension", "high bp", "high blood pressure", "hbp"],
    common: true
  },
  {
    code: "BA01",
    name: "Hypertensive Heart Disease",
    category: "Cardiovascular",
    keywords: ["hypertension", "heart disease", "cardiac"],
    common: false
  },
  {
    code: "BC20",
    name: "Ischaemic Heart Disease",
    category: "Cardiovascular",
    keywords: ["ihd", "heart disease", "angina", "chest pain"],
    common: false
  },
  {
    code: "BD10",
    name: "Heart Failure",
    category: "Cardiovascular",
    keywords: ["heart failure", "chf", "cardiac failure"],
    common: false
  },

  // ENDOCRINE/METABOLIC
  {
    code: "5A11",
    name: "Type 2 Diabetes Mellitus",
    category: "Endocrine",
    keywords: ["diabetes", "dm", "sugar", "high sugar", "diabetic"],
    common: true
  },
  {
    code: "5A10",
    name: "Type 1 Diabetes Mellitus",
    category: "Endocrine",
    keywords: ["diabetes", "type 1", "insulin dependent"],
    common: false
  },
  {
    code: "5A00",
    name: "Thyroid Disorders",
    category: "Endocrine",
    keywords: ["thyroid", "goiter", "hyperthyroid", "hypothyroid"],
    common: false
  },

  // GASTROINTESTINAL
  {
    code: "DA90",
    name: "Gastritis",
    category: "Gastrointestinal",
    keywords: ["gastritis", "stomach pain", "stomach upset", "indigestion"],
    common: true
  },
  {
    code: "DA26",
    name: "Peptic Ulcer Disease",
    category: "Gastrointestinal",
    keywords: ["ulcer", "peptic ulcer", "stomach ulcer", "duodenal ulcer"],
    common: true
  },
  {
    code: "DD90",
    name: "Dyspepsia",
    category: "Gastrointestinal",
    keywords: ["dyspepsia", "indigestion", "heartburn", "acid reflux"],
    common: true
  },
  {
    code: "DA97",
    name: "Constipation",
    category: "Gastrointestinal",
    keywords: ["constipation", "no stool", "hard stool"],
    common: true
  },

  // MUSCULOSKELETAL
  {
    code: "FA26",
    name: "Osteoarthritis",
    category: "Musculoskeletal",
    keywords: ["arthritis", "joint pain", "osteoarthritis", "oa"],
    common: true
  },
  {
    code: "FA20",
    name: "Rheumatoid Arthritis",
    category: "Musculoskeletal",
    keywords: ["rheumatoid", "ra", "arthritis", "joint pain"],
    common: false
  },
  {
    code: "ME84",
    name: "Back Pain",
    category: "Musculoskeletal",
    keywords: ["back pain", "backache", "lower back pain", "lbp"],
    common: true
  },
  {
    code: "FB56",
    name: "Gout",
    category: "Musculoskeletal",
    keywords: ["gout", "uric acid", "joint pain", "toe pain"],
    common: false
  },

  // RESPIRATORY
  {
    code: "CA23",
    name: "Asthma",
    category: "Respiratory",
    keywords: ["asthma", "wheezing", "breathing difficulty", "bronchospasm"],
    common: true
  },
  {
    code: "CB03",
    name: "Chronic Obstructive Pulmonary Disease (COPD)",
    category: "Respiratory",
    keywords: ["copd", "chronic bronchitis", "emphysema", "smoker"],
    common: false
  },
  {
    code: "CA40.2",
    name: "Pharyngitis",
    category: "Respiratory",
    keywords: ["pharyngitis", "sore throat", "throat pain"],
    common: true
  },
  {
    code: "CA13",
    name: "Tonsillitis",
    category: "Respiratory",
    keywords: ["tonsillitis", "tonsils", "throat infection"],
    common: true
  },
  {
    code: "CA15",
    name: "Sinusitis",
    category: "Respiratory",
    keywords: ["sinusitis", "sinus", "facial pain", "nasal congestion"],
    common: true
  },

  // SKIN CONDITIONS
  {
    code: "EA90",
    name: "Dermatitis",
    category: "Dermatology",
    keywords: ["dermatitis", "eczema", "skin rash", "itchy skin"],
    common: true
  },
  {
    code: "EA80",
    name: "Urticaria (Hives)",
    category: "Dermatology",
    keywords: ["urticaria", "hives", "rash", "allergic rash", "itchy"],
    common: true
  },
  {
    code: "1F2B",
    name: "Fungal Skin Infection",
    category: "Dermatology",
    keywords: ["fungal", "ringworm", "athlete's foot", "tinea"],
    common: true
  },
  {
    code: "EA92",
    name: "Acne",
    category: "Dermatology",
    keywords: ["acne", "pimples", "facial spots"],
    common: true
  },

  // HEADACHES
  {
    code: "8A80.0",
    name: "Tension-type Headache",
    category: "Neurological",
    keywords: ["headache", "tension", "head pain"],
    common: true
  },
  {
    code: "8A80.1",
    name: "Migraine",
    category: "Neurological",
    keywords: ["migraine", "severe headache", "one-sided headache"],
    common: true
  },

  // PREGNANCY RELATED
  {
    code: "JA00",
    name: "Normal Pregnancy",
    category: "Obstetric",
    keywords: ["pregnancy", "pregnant", "antenatal", "expecting"],
    common: true
  },
  {
    code: "JA65",
    name: "Pregnancy-induced Hypertension",
    category: "Obstetric",
    keywords: ["pregnancy", "high bp", "pre-eclampsia", "gestational hypertension"],
    common: false
  },

  // ALLERGIES
  {
    code: "4A84",
    name: "Allergic Rhinitis",
    category: "Allergy",
    keywords: ["allergic rhinitis", "hay fever", "nasal allergy", "sneezing"],
    common: true
  },
  {
    code: "4A85",
    name: "Anaphylactic Shock",
    category: "Allergy",
    keywords: ["anaphylaxis", "severe allergy", "allergic shock"],
    common: false
  },

  // MENTAL HEALTH
  {
    code: "6A70",
    name: "Depression",
    category: "Mental Health",
    keywords: ["depression", "depressed", "low mood", "sad"],
    common: false
  },
  {
    code: "6B00",
    name: "Anxiety Disorder",
    category: "Mental Health",
    keywords: ["anxiety", "panic", "worry", "stress"],
    common: false
  },

  // EYE CONDITIONS
  {
    code: "9A60",
    name: "Conjunctivitis",
    category: "Ophthalmology",
    keywords: ["conjunctivitis", "pink eye", "red eye", "eye infection"],
    common: true
  },

  // EAR CONDITIONS
  {
    code: "AA00",
    name: "Otitis Media (Ear Infection)",
    category: "ENT",
    keywords: ["ear infection", "otitis", "ear pain", "earache"],
    common: true
  },

  // ANEMIA
  {
    code: "3A00",
    name: "Iron Deficiency Anemia",
    category: "Hematology",
    keywords: ["anemia", "anaemia", "low blood", "iron deficiency"],
    common: true
  },

  // INJURIES/TRAUMA
  {
    code: "NA00",
    name: "Wound, Open",
    category: "Injury",
    keywords: ["wound", "cut", "laceration", "injury"],
    common: true
  },
  {
    code: "NA20",
    name: "Fracture",
    category: "Injury",
    keywords: ["fracture", "broken bone", "bone break"],
    common: true
  },
  {
    code: "NA30",
    name: "Sprain/Strain",
    category: "Injury",
    keywords: ["sprain", "strain", "twisted", "pulled muscle"],
    common: true
  },
]

// Search/filter function for autocomplete
export function searchDiagnoses(query: string, limit: number = 10): Diagnosis[] {
  if (!query || query.trim().length < 2) {
    // Return common diagnoses if no query
    return icd11Diagnoses.filter(d => d.common).slice(0, limit)
  }

  const searchTerm = query.toLowerCase().trim()
  
  // Search in name, code, and keywords
  const matches = icd11Diagnoses.filter(diagnosis => {
    const nameMatch = diagnosis.name.toLowerCase().includes(searchTerm)
    const codeMatch = diagnosis.code.toLowerCase().includes(searchTerm)
    const keywordMatch = diagnosis.keywords.some(keyword => 
      keyword.toLowerCase().includes(searchTerm) || 
      searchTerm.includes(keyword.toLowerCase())
    )
    
    return nameMatch || codeMatch || keywordMatch
  })

  // Sort by relevance (exact matches first, then common conditions)
  return matches.sort((a, b) => {
    const aExact = a.name.toLowerCase().startsWith(searchTerm) ? 1 : 0
    const bExact = b.name.toLowerCase().startsWith(searchTerm) ? 1 : 0
    const aCommon = a.common ? 1 : 0
    const bCommon = b.common ? 1 : 0
    
    return (bExact - aExact) || (bCommon - aCommon)
  }).slice(0, limit)
}

// Get diagnosis by code
export function getDiagnosisByCode(code: string): Diagnosis | undefined {
  return icd11Diagnoses.find(d => d.code === code)
}

// Get all diagnoses by category
export function getDiagnosesByCategory(category: string): Diagnosis[] {
  return icd11Diagnoses.filter(d => d.category === category)
}

// Get all categories
export function getCategories(): string[] {
  const categories = new Set(icd11Diagnoses.map(d => d.category))
  return Array.from(categories).sort()
}

// Get common diagnoses
export function getCommonDiagnoses(): Diagnosis[] {
  return icd11Diagnoses.filter(d => d.common)
}

