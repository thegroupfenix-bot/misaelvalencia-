// Dynamic breed database — Live Animals export
// species: SHEEP | GOATS | CATTLE
// Origins are countries from which this breed is commonly exported

export const BREEDS = {
  SHEEP: [
    { id: "DORPER",       name: "Dorper",          origins: ["Brazil","South Africa","Australia","New Zealand"], avgWeight: 47, weightRange: "38–55 kg" },
    { id: "WHITE_DORPER", name: "White Dorper",     origins: ["Brazil","South Africa"],                          avgWeight: 44, weightRange: "36–52 kg" },
    { id: "SANTA_INES",   name: "Santa Inês",       origins: ["Brazil"],                                         avgWeight: 42, weightRange: "35–50 kg" },
    { id: "TEXEL",        name: "Texel",            origins: ["Brazil","Uruguay","Argentina"],                   avgWeight: 80, weightRange: "60–100 kg" },
    { id: "MERINO",       name: "Merino",           origins: ["Australia","New Zealand","Uruguay","Argentina","South Africa"], avgWeight: 65, weightRange: "50–80 kg" },
    { id: "CORRIEDALE",   name: "Corriedale",       origins: ["Uruguay","Argentina","New Zealand"],              avgWeight: 70, weightRange: "55–85 kg" },
    { id: "SUFFOLK",      name: "Suffolk",          origins: ["Australia","New Zealand","USA"],                  avgWeight: 90, weightRange: "70–110 kg" },
    { id: "HAMPSHIRE",    name: "Hampshire Down",   origins: ["Australia","New Zealand"],                        avgWeight: 85, weightRange: "65–100 kg" },
    { id: "DOHNE_MERINO", name: "Dohne Merino",     origins: ["South Africa","Australia"],                       avgWeight: 72, weightRange: "55–90 kg" },
    { id: "ILE_DE_FRANCE",name: "Île-de-France",   origins: ["Brazil"],                                         avgWeight: 95, weightRange: "75–115 kg" },
  ],
  GOATS: [
    { id: "BOER",          name: "Boer",            origins: ["South Africa","Australia","Brazil","New Zealand"], avgWeight: 95, weightRange: "70–120 kg" },
    { id: "ANGLO_NUBIAN",  name: "Anglo Nubian",    origins: ["Brazil","South Africa","USA"],                     avgWeight: 65, weightRange: "50–80 kg" },
    { id: "SAANEN",        name: "Saanen",          origins: ["Brazil","Chile"],                                  avgWeight: 70, weightRange: "55–85 kg" },
    { id: "KALAHARI_RED",  name: "Kalahari Red",    origins: ["South Africa","Australia"],                        avgWeight: 80, weightRange: "65–100 kg" },
  ],
  CATTLE: [
    { id: "NELORE",      name: "Nelore",          origins: ["Brazil"],                                              avgWeight: 450, weightRange: "350–550 kg" },
    { id: "ANGUS",       name: "Angus",           origins: ["Brazil","Uruguay","Argentina","USA","Australia"],      avgWeight: 520, weightRange: "400–650 kg" },
    { id: "BRAHMAN",     name: "Brahman",         origins: ["Brazil","Colombia","USA","Australia"],                 avgWeight: 480, weightRange: "380–580 kg" },
    { id: "BRANGUS",     name: "Brangus",         origins: ["Brazil","Argentina","USA"],                           avgWeight: 500, weightRange: "400–600 kg" },
    { id: "HEREFORD",    name: "Hereford",        origins: ["Uruguay","Argentina","Brazil","Australia"],            avgWeight: 550, weightRange: "430–680 kg" },
    { id: "BRAFORD",     name: "Braford",         origins: ["Brazil","Australia"],                                  avgWeight: 480, weightRange: "380–580 kg" },
    { id: "GYR",         name: "Gyr",             origins: ["Brazil"],                                              avgWeight: 420, weightRange: "330–520 kg" },
    { id: "GIROLANDO",   name: "Girolando",       origins: ["Brazil"],                                              avgWeight: 440, weightRange: "350–540 kg" },
  ],
};

export const SPECIES_LABELS = {
  SHEEP: { es: "Ovinos", en: "Sheep" },
  GOATS: { es: "Caprinos", en: "Goats" },
  CATTLE: { es: "Bovinos", en: "Cattle" },
};

// Get breeds for a species, filtered by origin country if provided
export function getBreedsForSpecies(species, originCountry) {
  const all = BREEDS[species] || [];
  if (!originCountry) return all;
  return all.filter(b => b.origins.some(o => o.toLowerCase().includes(originCountry.toLowerCase()) || originCountry.toLowerCase().includes(o.toLowerCase())));
}
