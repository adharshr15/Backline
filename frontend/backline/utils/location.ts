export const COUNTRY_LIST = [
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'AU', name: 'Australia' },
    { code: 'IE', name: 'Ireland' },
    { code: 'NZ', name: 'New Zealand' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'JP', name: 'Japan' },
    { code: 'BR', name: 'Brazil' },
    { code: 'MX', name: 'Mexico' },
    { code: 'ZA', name: 'South Africa' },
    { code: 'AF', name: 'Afghanistan' },
    { code: 'AL', name: 'Albania' },
    { code: 'DZ', name: 'Algeria' },
    { code: 'AR', name: 'Argentina' },
    { code: 'AT', name: 'Austria' },
    { code: 'BE', name: 'Belgium' },
    { code: 'CL', name: 'Chile' },
    { code: 'CN', name: 'China' },
    { code: 'CO', name: 'Colombia' },
    { code: 'HR', name: 'Croatia' },
    { code: 'CZ', name: 'Czech Republic' },
    { code: 'DK', name: 'Denmark' },
    { code: 'EG', name: 'Egypt' },
    { code: 'FI', name: 'Finland' },
    { code: 'GH', name: 'Ghana' },
    { code: 'GR', name: 'Greece' },
    { code: 'HU', name: 'Hungary' },
    { code: 'IN', name: 'India' },
    { code: 'ID', name: 'Indonesia' },
    { code: 'IL', name: 'Israel' },
    { code: 'IT', name: 'Italy' },
    { code: 'KE', name: 'Kenya' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'NG', name: 'Nigeria' },
    { code: 'NO', name: 'Norway' },
    { code: 'PK', name: 'Pakistan' },
    { code: 'PE', name: 'Peru' },
    { code: 'PH', name: 'Philippines' },
    { code: 'PL', name: 'Poland' },
    { code: 'PT', name: 'Portugal' },
    { code: 'RO', name: 'Romania' },
    { code: 'RU', name: 'Russia' },
    { code: 'SA', name: 'Saudi Arabia' },
    { code: 'KR', name: 'South Korea' },
    { code: 'ES', name: 'Spain' },
    { code: 'SE', name: 'Sweden' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'TW', name: 'Taiwan' },
    { code: 'TH', name: 'Thailand' },
    { code: 'TR', name: 'Turkey' },
    { code: 'UA', name: 'Ukraine' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'VN', name: 'Vietnam' },
];

export const STATES_BY_COUNTRY: Record<string, { code: string; name: string }[]> = {
    US: [
        { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
        { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
        { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
        { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
        { code: 'DC', name: 'District of Columbia' }, { code: 'FL', name: 'Florida' },
        { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
        { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' },
        { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
        { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
        { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' },
        { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
        { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
        { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' },
        { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
        { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
        { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' },
        { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
        { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
        { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' },
        { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
        { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
        { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' },
        { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
        { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
        { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' },
        { code: 'WY', name: 'Wyoming' },
    ],
    CA: [
        { code: 'AB', name: 'Alberta' }, { code: 'BC', name: 'British Columbia' },
        { code: 'MB', name: 'Manitoba' }, { code: 'NB', name: 'New Brunswick' },
        { code: 'NL', name: 'Newfoundland and Labrador' }, { code: 'NS', name: 'Nova Scotia' },
        { code: 'NT', name: 'Northwest Territories' }, { code: 'NU', name: 'Nunavut' },
        { code: 'ON', name: 'Ontario' }, { code: 'PE', name: 'Prince Edward Island' },
        { code: 'QC', name: 'Quebec' }, { code: 'SK', name: 'Saskatchewan' },
        { code: 'YT', name: 'Yukon' },
    ],
    GB: [
        { code: 'ENG', name: 'England' }, { code: 'SCT', name: 'Scotland' },
        { code: 'WLS', name: 'Wales' }, { code: 'NIR', name: 'Northern Ireland' },
    ],
    AU: [
        { code: 'ACT', name: 'Australian Capital Territory' },
        { code: 'NSW', name: 'New South Wales' }, { code: 'NT', name: 'Northern Territory' },
        { code: 'QLD', name: 'Queensland' }, { code: 'SA', name: 'South Australia' },
        { code: 'TAS', name: 'Tasmania' }, { code: 'VIC', name: 'Victoria' },
        { code: 'WA', name: 'Western Australia' },
    ],
    IE: [
        { code: 'C', name: 'Connacht' }, { code: 'L', name: 'Leinster' },
        { code: 'M', name: 'Munster' }, { code: 'U', name: 'Ulster' },
    ],
    NZ: [
        { code: 'AUK', name: 'Auckland' }, { code: 'BOP', name: 'Bay of Plenty' },
        { code: 'CAN', name: 'Canterbury' }, { code: 'GIS', name: 'Gisborne' },
        { code: 'HKB', name: "Hawke's Bay" }, { code: 'MBH', name: 'Marlborough' },
        { code: 'MWT', name: 'Manawatu-Whanganui' }, { code: 'NSN', name: 'Nelson' },
        { code: 'NTL', name: 'Northland' }, { code: 'OTA', name: 'Otago' },
        { code: 'STL', name: 'Southland' }, { code: 'TAS', name: 'Tasman' },
        { code: 'TKI', name: 'Taranaki' }, { code: 'WGN', name: 'Wellington' },
        { code: 'WKO', name: 'Waikato' }, { code: 'WTC', name: 'West Coast' },
    ],
};

const STATE_CODES: Record<string, string> = {
    // US States
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
    // Canadian Provinces
    'Alberta': 'AB', 'British Columbia': 'BC', 'Manitoba': 'MB', 'New Brunswick': 'NB',
    'Newfoundland and Labrador': 'NL', 'Nova Scotia': 'NS', 'Ontario': 'ON',
    'Prince Edward Island': 'PE', 'Quebec': 'QC', 'Saskatchewan': 'SK',
    'Northwest Territories': 'NT', 'Nunavut': 'NU', 'Yukon': 'YT',
    // Australian States
    'New South Wales': 'NSW', 'Victoria': 'VIC', 'Queensland': 'QLD',
    'Western Australia': 'WA', 'South Australia': 'SA', 'Tasmania': 'TAS',
    'Australian Capital Territory': 'ACT', 'Northern Territory': 'NT',
    // UK
    'England': 'ENG', 'Scotland': 'SCT', 'Wales': 'WLS', 'Northern Ireland': 'NIR',
};

const COUNTRY_NAMES: Record<string, string> = {
    'AF': 'Afghanistan', 'AL': 'Albania', 'DZ': 'Algeria', 'AR': 'Argentina',
    'AU': 'Australia', 'AT': 'Austria', 'BE': 'Belgium', 'BR': 'Brazil',
    'CA': 'Canada', 'CL': 'Chile', 'CN': 'China', 'CO': 'Colombia',
    'HR': 'Croatia', 'CZ': 'Czech Republic', 'DK': 'Denmark', 'EG': 'Egypt',
    'FI': 'Finland', 'FR': 'France', 'DE': 'Germany', 'GH': 'Ghana',
    'GR': 'Greece', 'HU': 'Hungary', 'IN': 'India', 'ID': 'Indonesia',
    'IE': 'Ireland', 'IL': 'Israel', 'IT': 'Italy', 'JP': 'Japan',
    'KE': 'Kenya', 'MX': 'Mexico', 'NL': 'Netherlands', 'NZ': 'New Zealand',
    'NG': 'Nigeria', 'NO': 'Norway', 'PK': 'Pakistan', 'PE': 'Peru',
    'PH': 'Philippines', 'PL': 'Poland', 'PT': 'Portugal', 'RO': 'Romania',
    'RU': 'Russia', 'SA': 'Saudi Arabia', 'ZA': 'South Africa', 'KR': 'South Korea',
    'ES': 'Spain', 'SE': 'Sweden', 'CH': 'Switzerland', 'TW': 'Taiwan',
    'TH': 'Thailand', 'TR': 'Turkey', 'UA': 'Ukraine', 'AE': 'United Arab Emirates',
    'GB': 'United Kingdom', 'US': 'United States', 'VN': 'Vietnam',
};

export function toStateCode(name: string): string {
    if (!name) return '';
    const trimmed = name.trim();
    return STATE_CODES[trimmed] ?? trimmed;
}

export function toCountryCode(countrycode: string): string {
    return (countrycode ?? '').toUpperCase();
}

export function toCountryName(code: string): string {
    if (!code) return '';
    return COUNTRY_NAMES[code.toUpperCase()] ?? code;
}
