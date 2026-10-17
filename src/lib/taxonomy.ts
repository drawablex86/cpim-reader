export interface TaxonomyItem {
  slug: string;
  label: string;
  description?: string;
  translations?: Record<string, string>;
}

export const DOC_TYPES: Record<string, TaxonomyItem> = {
  resolution: {
    slug: 'resolution',
    label: 'Resolution',
    description: 'Formal resolutions adopted by Party Congresses or Central Committee meetings',
    translations: {
      ml: 'പ്രമേയം',
      hi: 'प्रस्ताव',
      bn: 'প্রস্তাব'
    }
  },
  report: {
    slug: 'report',
    label: 'Committee Report',
    description: 'Periodic political-organisational assessments and CC reports',
    translations: {
      ml: 'റിപ്പോർട്ട്',
      hi: 'रिपोर्ट',
      bn: 'প্রতিবেদন'
    }
  },
  review: {
    slug: 'review',
    label: 'Election & Tactical Review',
    description: 'Critical post-election reviews and evaluations of political tactics',
    translations: {
      ml: 'അവലോകനം',
      hi: 'समीक्षा',
      bn: 'পর্যালোচনা'
    }
  },
  manifesto: {
    slug: 'manifesto',
    label: 'Election Manifesto',
    description: 'Electoral programmes, pledges, and political appeals',
    translations: {
      ml: 'പ്രകടനപത്രിക',
      hi: 'घोषणापत्र',
      bn: 'ইশতেহার'
    }
  },
  speech: {
    slug: 'speech',
    label: 'Speech & Address',
    description: 'Inaugural, presidential, or commemorative speeches by leadership',
    translations: {
      ml: 'പ്രസംഗം',
      hi: 'भाषण',
      bn: 'বক্তৃতা'
    }
  },
  campaign: {
    slug: 'campaign',
    label: 'Campaign & Agitation',
    description: 'Mass mobilization calls, protest declarations, and popular campaigns',
    translations: {
      ml: 'പ്രചാരണം',
      hi: 'अभियान',
      bn: 'প্রচার অভিযান'
    }
  },
  publication: {
    slug: 'publication',
    label: 'Publication & Booklet',
    description: 'Theoretical, ideological, or thematic monographs and analytical booklets',
    translations: {
      ml: 'പ്രസിദ്ധീകരണം',
      hi: 'पुस्तिका',
      bn: 'পুস্তিকা'
    }
  },
  'policy-programme': {
    slug: 'policy-programme',
    label: 'Policy & Front Tasks',
    description: 'Sectoral policy agendas, charters, and mass organisation tasks',
    translations: {
      ml: 'നയരേഖ',
      hi: 'नीति एवं कार्यक्रम',
      bn: 'নীতি ও কর্মসূচি'
    }
  },
  legal: {
    slug: 'legal',
    label: 'Legal & Institutional',
    description: 'Writ petitions, judicial interventions, and submissions to statutory commissions',
    translations: {
      ml: 'നിയമരേഖ',
      hi: 'कानूनी दस्तावेज़',
      bn: 'আইনগত নথি'
    }
  },
  solidarity: {
    slug: 'solidarity',
    label: 'Fraternal Solidarity',
    description: 'Messages of greetings and solidarity from fraternal parties worldwide',
    translations: {
      ml: 'ഐക്യദാർഢ്യം',
      hi: 'एकजुटता संदेश',
      bn: 'সংহতি বার্তা'
    }
  }
};

export const TOPICS: Record<string, TaxonomyItem> = {
  'labour-workers': {
    slug: 'labour-workers',
    label: 'Labour & Workers',
    description: 'Trade unions, labour codes, strikes, minimum wages, and working class struggle',
    translations: {
      ml: 'തൊഴിലാളി & ട്രേഡ് യൂണിയൻ',
      hi: 'मज़दूर और श्रम अधिकार',
      bn: 'শ্রমিক ও ট্রেড ইউনিয়ন'
    }
  },
  'agriculture-farmers': {
    slug: 'agriculture-farmers',
    label: 'Agriculture & Farmers',
    description: 'Kisan struggles, MSP, agricultural policies, land rights, and rural workers',
    translations: {
      ml: 'കൃഷിയും കർഷകരും',
      hi: 'कृषि और किसान',
      bn: 'কৃষি ও কৃষক আন্দোলন'
    }
  },
  'economy-public-sector': {
    slug: 'economy-public-sector',
    label: 'Economy & Public Sector',
    description: 'Union budget, privatisation, public sector defense, inflation, and corporate looting',
    translations: {
      ml: 'സാമ്പത്തികം & പൊതുമേഖല',
      hi: 'अर्थव्यवस्था और सार्वजनिक क्षेत्र',
      bn: 'অর্থনীতি ও রাষ্ট্রায়ত্ত ক্ষেত্র'
    }
  },
  'communalism-secularism': {
    slug: 'communalism-secularism',
    label: 'Communalism & Secularism',
    description: 'Combating RSS/Hindutva communalism, defending minorities and secular fabric',
    translations: {
      ml: 'വർഗീയത & മതേതരത്വം',
      hi: 'सांप्रदायिकता और धर्मनिरपेक्षता',
      bn: 'সাম্প্রদায়িকতা ও ধর্মনিরপেক্ষতা'
    }
  },
  'caste-social-justice': {
    slug: 'caste-social-justice',
    label: 'Caste & Social Justice',
    description: 'Annihilation of caste, reservations, caste census, and Dalit/Adivasi rights',
    translations: {
      ml: 'ജാതി & സാമൂഹിക നീതി',
      hi: 'जाति और सामाजिक न्याय',
      bn: 'জাতিভেদ ও সামাজিক ন্যায়'
    }
  },
  'gender-womens-rights': {
    slug: 'gender-womens-rights',
    label: 'Gender & Women’s Rights',
    description: 'Struggles against patriarchy, crimes against women, equal rights, and representation',
    translations: {
      ml: 'സ്ത്രീ അവകാശങ്ങൾ',
      hi: 'महिला अधिकार और लैंगिक न्याय',
      bn: 'নারী অধিকার'
    }
  },
  'education-students': {
    slug: 'education-students',
    label: 'Education & Youth',
    description: 'National Education Policy, UGC, university autonomy, student struggles, and jobs',
    translations: {
      ml: 'വിദ്യാഭ്യാസം & യുവാക്കൾ',
      hi: 'शिक्षा और युवा',
      bn: 'শিক্ষা ও যুবসমাজ'
    }
  },
  healthcare: {
    slug: 'healthcare',
    label: 'Public Health',
    description: 'Right to healthcare, public health infrastructure, and drug access',
    translations: {
      ml: 'ആരോഗ്യം',
      hi: 'स्वास्थ्य सेवा',
      bn: 'জনস্বাস্থ্য'
    }
  },
  'federalism-states': {
    slug: 'federalism-states',
    label: 'Federalism & States',
    description: 'Centre-state relations, devolution of funds, Governor overreach, and state rights',
    translations: {
      ml: 'ഫെഡറലിസം & സംസ്ഥാനങ്ങൾ',
      hi: 'संघवाद और राज्य',
      bn: 'যুক্তরাষ্ট্র কাঠামো'
    }
  },
  'elections-democracy': {
    slug: 'elections-democracy',
    label: 'Elections & Democracy',
    description: 'Electoral reforms, EVMs, delimitation, civil liberties, and democratic rights',
    translations: {
      ml: 'തെരഞ്ഞെടുപ്പ് & ജനാധിപത്യം',
      hi: 'चुनाव और लोकतंत्र',
      bn: 'নির্বাচন ও গণতন্ত্র'
    }
  },
  'anti-imperialism': {
    slug: 'anti-imperialism',
    label: 'Anti-Imperialism',
    description: 'Resistance to US imperialism, unjust trade deals, foreign policy, and sovereignty',
    translations: {
      ml: 'സാമ്രാജ്യത്വ വിരുദ്ധത',
      hi: 'साम्राज्यवाद विरोध',
      bn: 'সাম্রাজ্যবাদ বিরোধিতা'
    }
  },
  palestine: {
    slug: 'palestine',
    label: 'Palestine Solidarity',
    description: 'Solidarity with Gaza and the Palestinian struggle against Zionist genocide',
    translations: {
      ml: 'പലസ്തീൻ ഐക്യദാർഢ്യം',
      hi: 'फ़िलिस्तीन एकजुटता',
      bn: 'ফিলিস্তিন সংহতি'
    }
  },
  'environment-climate': {
    slug: 'environment-climate',
    label: 'Environment & Climate',
    description: 'Ecological protection, climate change, and opposition to predatory resource extraction',
    translations: {
      ml: 'പരിസ്ഥിതി',
      hi: 'पर्यावरण और जलवायु',
      bn: 'পরিবেশ ও জলবায়ু'
    }
  },
  'disability-lgbtq': {
    slug: 'disability-lgbtq',
    label: 'Disability & LGBTQI+',
    description: 'Rights, accessibility, and dignity for disabled persons and LGBTQI+ communities',
    translations: {
      ml: 'ഭിന്നശേഷി & എൽജിബിടിക്യുഐ+',
      hi: 'दिव्यांग व एलजीबीटीक्यू अधिकार',
      bn: 'প্রতিবন্ধী ও রূপান্তরকামী অধিকার'
    }
  }
};

export const GEOGRAPHY: Record<string, TaxonomyItem> = {
  national: { slug: 'national', label: 'All-India' },
  kerala: { slug: 'kerala', label: 'Kerala', translations: { ml: 'കേരളം' } },
  'west-bengal': { slug: 'west-bengal', label: 'West Bengal', translations: { bn: 'পশ্চিমবঙ্গ' } },
  tripura: { slug: 'tripura', label: 'Tripura' },
  'jammu-kashmir': { slug: 'jammu-kashmir', label: 'Jammu & Kashmir' },
  manipur: { slug: 'manipur', label: 'Manipur' },
  'andhra-pradesh': { slug: 'andhra-pradesh', label: 'Andhra Pradesh' },
  telangana: { slug: 'telangana', label: 'Telangana' },
  palestine: { slug: 'palestine', label: 'Palestine', translations: { ml: 'പലസ്തീൻ' } },
  cuba: { slug: 'cuba', label: 'Cuba' },
  international: { slug: 'international', label: 'International', translations: { ml: 'അന്താരാഷ്ട്രം' } }
};

export function getDocTypeLabel(slug: string, lang = 'en'): string {
  const item = DOC_TYPES[slug];
  if (!item) return slug.toUpperCase();
  if (lang !== 'en' && item.translations?.[lang]) {
    return item.translations[lang];
  }
  return item.label;
}

export function getTopicLabel(slug: string, lang = 'en'): string {
  const item = TOPICS[slug];
  if (!item) return slug;
  if (lang !== 'en' && item.translations?.[lang]) {
    return item.translations[lang];
  }
  return item.label;
}

export function getGeoLabel(slug: string, lang = 'en'): string {
  const item = GEOGRAPHY[slug];
  if (!item) return slug;
  if (lang !== 'en' && item.translations?.[lang]) {
    return item.translations[lang];
  }
  return item.label;
}
