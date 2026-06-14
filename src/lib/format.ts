export const fmt = (n: number | string) => {
  const f = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(f)) return '0';
  return f % 1 === 0 ? f.toLocaleString() : f.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const getTodayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: '2-digit' };
  return d.toLocaleDateString('en-GB', options).replace(/ /g, ' ');
};

export const getMonthYear = (dateStr: string) => {
  const d = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { month: 'short', year: '2-digit' };
  return d.toLocaleDateString('en-GB', options);
};
