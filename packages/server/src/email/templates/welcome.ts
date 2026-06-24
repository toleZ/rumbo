export function welcomeTemplate(name?: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #1f2937;">¡Bienvenido a Rumbo!</h2>
      <p style="color: #4b5563;">Hola${name ? ` ${name}` : ''},</p>
      <p style="color: #4b5563;">Tu cuenta ha sido verificada exitosamente. Ya puedes comenzar a usar todas las funcionalidades:</p>
      <ul style="color: #4b5563; line-height: 1.8;">
        <li>📋 Tableros Kanban para organizar tareas</li>
        <li>📝 Notas con editor de texto enriquecido</li>
        <li>📅 Vista de calendario</li>
        <li>🎯 Seguimiento de hábitos</li>
        <li>🍅 Temporizador Pomodoro</li>
      </ul>
      <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">¡Mucho éxito organizando tus proyectos!</p>
    </div>
  `
}
