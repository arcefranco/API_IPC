export const getFirstDayCurrentMonth = (fecha = new Date()) => {
  const firstDayCurrentMonth = new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    1
  );

  const year = firstDayCurrentMonth.getFullYear();
  const month = String(firstDayCurrentMonth.getMonth() + 1).padStart(2, "0");
  const day = String(firstDayCurrentMonth.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};