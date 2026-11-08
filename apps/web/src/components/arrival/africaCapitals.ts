// Capitales placées avec la projection du contour (Equal Earth, ajustée à
// la boîte de 1000 sur 1000 de africaOutline.ts : échelle 709,33, centre
// 321 ; 516,19). Coordonnées géographiques publiques.

export interface Capital {
  id: string;
  name: string;
  x: number;
  y: number;
}

export const CAPITALS: readonly Capital[] = [
  { id: "rabat", name: "Rabat", x: 254.1, y: 42.7 },
  { id: "alger", name: "Alger", x: 350.5, y: 7.6 },
  { id: "tunis", name: "Tunis", x: 419.1, y: 6.9 },
  { id: "tripoli", name: "Tripoli", x: 450.8, y: 57.5 },
  { id: "caire", name: "Le Caire", x: 632.6, y: 95.1 },
  { id: "nouakchott", name: "Nouakchott", x: 154.6, y: 258.7 },
  { id: "dakar", name: "Dakar", x: 137.8, y: 306.3 },
  { id: "bamako", name: "Bamako", x: 236.7, y: 335.3 },
  { id: "conakry", name: "Conakry", x: 177.1, y: 378.0 },
  { id: "yamoussoukro", name: "Yamoussoukro", x: 264.9, y: 418.3 },
  { id: "ouagadougou", name: "Ouagadougou", x: 305.0, y: 339.2 },
  { id: "accra", name: "Accra", x: 319.0, y: 435.8 },
  { id: "niamey", name: "Niamey", x: 343.2, y: 323.0 },
  { id: "abuja", name: "Abuja", x: 400.4, y: 386.3 },
  { id: "ndjamena", name: "N'Djamena", x: 479.7, y: 342.6 },
  { id: "khartoum", name: "Khartoum", x: 661.9, y: 294.9 },
  { id: "addis", name: "Addis-Abeba", x: 731.9, y: 386.7 },
  { id: "mogadiscio", name: "Mogadiscio", x: 804.2, y: 486.7 },
  { id: "yaounde", name: "Yaoundé", x: 443.5, y: 460.6 },
  { id: "libreville", name: "Libreville", x: 421.8, y: 510.6 },
  { id: "kinshasa", name: "Kinshasa", x: 483.6, y: 580.0 },
  { id: "kampala", name: "Kampala", x: 668.5, y: 511.2 },
  { id: "kigali", name: "Kigali", x: 641.5, y: 544.1 },
  { id: "nairobi", name: "Nairobi", x: 713.7, y: 534.7 },
  { id: "dodoma", name: "Dodoma", x: 701.2, y: 604.6 },
  { id: "luanda", name: "Luanda", x: 461.3, y: 643.0 },
  { id: "lusaka", name: "Lusaka", x: 617.9, y: 735.9 },
  { id: "harare", name: "Harare", x: 644.6, y: 770.2 },
  { id: "antananarivo", name: "Antananarivo", x: 814.8, y: 784.9 },
  { id: "windhoek", name: "Windhoek", x: 496.5, y: 835.9 },
  { id: "gaborone", name: "Gaborone", x: 585.2, y: 864.6 },
  { id: "pretoria", name: "Pretoria", x: 607.3, y: 879.6 },
  { id: "maputo", name: "Maputo", x: 651.5, y: 882.6 },
];

// Liaisons du réseau, entre capitales voisines. L'ordre d'allumage est
// mélangé à part (NETWORK_ORDER) : deux liaisons qui se suivent ne sont
// jamais au même endroit.
export const NETWORK_LINKS: ReadonlyArray<readonly [string, string]> = [
  ["dakar", "nouakchott"],
  ["dakar", "bamako"],
  ["dakar", "conakry"],
  ["rabat", "alger"],
  ["alger", "tunis"],
  ["tunis", "tripoli"],
  ["tripoli", "caire"],
  ["rabat", "nouakchott"],
  ["bamako", "ouagadougou"],
  ["ouagadougou", "niamey"],
  ["ouagadougou", "accra"],
  ["yamoussoukro", "accra"],
  ["conakry", "yamoussoukro"],
  ["accra", "abuja"],
  ["niamey", "abuja"],
  ["abuja", "ndjamena"],
  ["abuja", "yaounde"],
  ["yaounde", "libreville"],
  ["libreville", "kinshasa"],
  ["kinshasa", "luanda"],
  ["kinshasa", "kigali"],
  ["kigali", "kampala"],
  ["kampala", "nairobi"],
  ["nairobi", "addis"],
  ["addis", "khartoum"],
  ["khartoum", "caire"],
  ["khartoum", "ndjamena"],
  ["addis", "mogadiscio"],
  ["nairobi", "dodoma"],
  ["dodoma", "lusaka"],
  ["lusaka", "harare"],
  ["harare", "maputo"],
  ["maputo", "pretoria"],
  ["pretoria", "gaborone"],
  ["gaborone", "windhoek"],
  ["windhoek", "luanda"],
  ["lusaka", "luanda"],
  ["harare", "antananarivo"],
  ["dodoma", "antananarivo"],
  ["niamey", "alger"],
  ["tripoli", "ndjamena"],
  ["bamako", "yamoussoukro"],
  ["nairobi", "mogadiscio"],
];
