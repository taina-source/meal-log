export function chartAxes(series: { unit?: string; points: { value: number }[] }[], unit: string, zero: boolean, target?: number) {
  const units = [...new Set(series.map(line => line.unit ?? unit))];
  if (!units.length) units.push(unit);
  return units.map((axisUnit, index) => {
    const values = series.filter(line => (line.unit ?? unit) === axisUnit).flatMap(line => line.points.map(point => point.value)).filter(Number.isFinite);
    if (index === 0 && target !== undefined && Number.isFinite(target)) values.push(target);
    let min = zero ? 0 : values.reduce((a,b)=>Math.min(a,b),Infinity), max = values.reduce((a,b)=>Math.max(a,b),-Infinity);
    if (!values.length) { min = 0; max = 1; }
    const padding = Math.max((max - min) * .12, zero ? axisUnit === 'g' ? 5 : 100 : .5);
    if (!zero) min -= padding;
    max += padding;
    return { unit: axisUnit, min, max };
  });
}
