export function getNextBusinessDay(date: Date): Date {
  const newDate = new Date(date);
  
  // Tabela de feriados fixos (formato MM-DD)
  const fixedHolidays = [
    '01-01', // Confraternização Universal
    '04-21', // Tiradentes
    '05-01', // Dia do Trabalhador
    '09-07', // Independência
    '10-12', // Nossa Senhora Aparecida
    '11-02', // Finados
    '11-15', // Proclamação da República
    '11-20', // Consciência Negra (dependendo do estado, mas vamos considerar Nacional)
    '12-25', // Natal
  ];
  
  // Feriados móveis não estão perfeitamente incluídos aqui (Carnaval, Páscoa, Corpus Christi) 
  // mas garantimos os finais de semana e os principais fixos.
  
  let validDate = false;
  
  while (!validDate) {
    const dayOfWeek = newDate.getDay();
    const month = String(newDate.getMonth() + 1).padStart(2, '0');
    const day = String(newDate.getDate()).padStart(2, '0');
    const dateString = `${month}-${day}`;
    
    // Check if it's weekend (0 = Sunday, 6 = Saturday)
    if (dayOfWeek === 0) {
      newDate.setDate(newDate.getDate() + 1); // Move to Monday
    } else if (dayOfWeek === 6) {
      newDate.setDate(newDate.getDate() + 2); // Move to Monday
    } 
    // Check if it's a fixed holiday
    else if (fixedHolidays.includes(dateString)) {
      newDate.setDate(newDate.getDate() + 1); // Move forward one day and check again
    } else {
      validDate = true;
    }
  }
  
  return newDate;
}
