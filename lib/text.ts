/** Varlık adlarını karşılaştırmak için: boşlukları sadeleştirir, Türkçe kurallarla küçültür. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

/** Görünen ad: boşlukları sadeleştirir, ilk harfi Türkçe kurallarla büyütür. */
export function displayName(name: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  return clean.charAt(0).toLocaleUpperCase("tr-TR") + clean.slice(1);
}
