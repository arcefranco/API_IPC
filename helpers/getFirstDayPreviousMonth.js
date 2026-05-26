export const getFirstDayPreviousMonth = (fecha = new Date()) => {
  const year = fecha.getFullYear();
  const month = fecha.getMonth(); // mes actual (0-11)

  // Crear fecha del primer día del mes anterior
  const firstDayPrevMonth = new Date(year, month - 1, 1);

  return firstDayPrevMonth.toISOString().split("T")[0];
};

export const getFirstDayNextMonth = (fecha = new Date()) => {
  const year = fecha.getFullYear();
  const month = fecha.getMonth(); // mes actual (0-11)

  // Crear fecha del primer día del mes siguiente
  const firstDayNextMonth = new Date(year, month + 1, 1);

  return firstDayNextMonth.toISOString().split("T")[0];
};