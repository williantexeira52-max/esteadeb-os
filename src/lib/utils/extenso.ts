/**
 * Converts a number to its written form in Portuguese (BRL currency context).
 */
export function valorPorExtenso(valor: number): string {
  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const dezena_1 = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  if (valor === 0) return "zero reais";

  const reais = Math.floor(valor);
  const centavos = Math.round((valor - reais) * 100);

  function converter(n: number): string {
    if (n === 0) return "";
    if (n === 100) return "cem";
    
    let res = "";
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (c > 0) res += centenas[c];
    if (d > 0) {
      if (res !== "") res += " e ";
      if (d === 1) {
        res += dezena_1[u];
        return res;
      } else {
        res += dezenas[d];
      }
    }
    if (u > 0) {
      if (res !== "" && d !== 1) res += " e ";
      if (d !== 1) res += unidades[u];
    }
    return res;
  }

  let extenso = "";

  if (reais > 0) {
    if (reais < 1000) {
      extenso = converter(reais);
    } else if (reais < 1000000) {
        const mil = Math.floor(reais / 1000);
        const resto = reais % 1000;
        extenso = (mil === 1 ? "mil" : converter(mil) + " mil") + (resto > 0 ? (resto < 100 || resto % 100 === 0 ? " e " : " ") + converter(resto) : "");
    }
    extenso += (reais === 1 ? " real" : " reais");
  }

  if (centavos > 0) {
    if (extenso !== "") extenso += " e ";
    extenso += converter(centavos) + (centavos === 1 ? " centavo" : " centavos");
  }

  return extenso;
}
