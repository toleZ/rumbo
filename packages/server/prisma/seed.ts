import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function hashPw(password: string) {
  return bcrypt.hash(password, 10)
}

async function main() {
  console.log('Seeding database...')

  // Clean existing data
  await prisma.habitCompletion.deleteMany()
  await prisma.habit.deleteMany()
  await prisma.taskLabel.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.subtask.deleteMany()
  await prisma.task.deleteMany()
  await prisma.column.deleteMany()
  await prisma.board.deleteMany()
  await prisma.note.deleteMany()
  await prisma.folder.deleteMany()
  await prisma.label.deleteMany()
  await prisma.verificationCode.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.user.deleteMany()

  // ═══════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════
  const users = await Promise.all([
    prisma.user.create({
      data: { email: 'demo@rumbo.app', password: await hashPw('demo1234'), name: 'Demo Usuario', emailVerified: true },
    }),
    prisma.user.create({
      data: { email: 'maria@test.com', password: await hashPw('test1234'), name: 'María García', emailVerified: true },
    }),
    prisma.user.create({
      data: { email: 'carlos@test.com', password: await hashPw('test1234'), name: 'Carlos López', emailVerified: true },
    }),
    prisma.user.create({
      data: { email: 'lucia@test.com', password: await hashPw('test1234'), name: 'Lucía Martínez', emailVerified: true },
    }),
    prisma.user.create({
      data: { email: 'andres@test.com', password: await hashPw('test1234'), name: 'Andrés Rodríguez', emailVerified: true },
    }),
  ])

  const [demo, maria, carlos, lucia, andres] = users

  // ═══════════════════════════════════════════
  // LABELS (per user)
  // ═══════════════════════════════════════════
  async function createLabelsForUser(userId: string, boardId: string) {
    return Promise.all([
      prisma.label.create({ data: { name: 'Urgente', color: '#ef4444', userId, boardId } }),
      prisma.label.create({ data: { name: 'Personal', color: '#22c55e', userId, boardId } }),
      prisma.label.create({ data: { name: 'Trabajo', color: '#3b82f6', userId, boardId } }),
      prisma.label.create({ data: { name: 'Estudio', color: '#8b5cf6', userId, boardId } }),
      prisma.label.create({ data: { name: 'Salud', color: '#f97316', userId, boardId } }),
      prisma.label.create({ data: { name: 'Finanzas', color: '#06b6d4', userId, boardId } }),
      prisma.label.create({ data: { name: 'Ideas', color: '#eab308', userId, boardId } }),
      prisma.label.create({ data: { name: 'Reunión', color: '#ec4899', userId, boardId } }),
    ])
  }

  // ═══════════════════════════════════════════
  // BOARDS + COLUMNS (Demo user - main)
  // ═══════════════════════════════════════════
  const boardTrabajo = await prisma.board.create({
    data: {
      name: 'Trabajo', color: '#3b82f6', order: 0, userId: demo.id,
      columns: {
        create: [
          { title: 'Backlog', order: 0 },
          { title: 'Por Hacer', order: 1 },
          { title: 'En Progreso', order: 2 },
          { title: 'En Revisión', order: 3 },
          { title: 'Completado', order: 4 },
        ],
      },
    },
    include: { columns: true },
  })

  const boardPersonal = await prisma.board.create({
    data: {
      name: 'Personal', color: '#22c55e', order: 1, userId: demo.id,
      columns: {
        create: [
          { title: 'Ideas', order: 0 },
          { title: 'Planificado', order: 1 },
          { title: 'Haciendo', order: 2 },
          { title: 'Hecho', order: 3 },
        ],
      },
    },
    include: { columns: true },
  })

  const boardEstudios = await prisma.board.create({
    data: {
      name: 'Estudios', color: '#8b5cf6', order: 2, userId: demo.id,
      columns: {
        create: [
          { title: 'Por Estudiar', order: 0 },
          { title: 'Estudiando', order: 1 },
          { title: 'Repasar', order: 2 },
          { title: 'Dominado', order: 3 },
        ],
      },
    },
    include: { columns: true },
  })

  const boardFreelance = await prisma.board.create({
    data: {
      name: 'Freelance', color: '#f97316', order: 3, userId: demo.id,
      columns: {
        create: [
          { title: 'Propuestas', order: 0 },
          { title: 'En Desarrollo', order: 1 },
          { title: 'Testing', order: 2 },
          { title: 'Entregado', order: 3 },
        ],
      },
    },
    include: { columns: true },
  })

  // ═══════════════════════════════════════════
  // LABELS (per user, scoped to their main board)
  // ═══════════════════════════════════════════
  const demoLabels = await createLabelsForUser(demo.id, boardTrabajo.id)
  const [urgente, personal, trabajo, estudio, salud, finanzas, ideas, reunion] = demoLabels

  // ═══════════════════════════════════════════
  // TASKS (Demo user - Trabajo board)
  // ═══════════════════════════════════════════
  const [tBacklog, tPorHacer, tEnProgreso, tEnRevision, tCompletado] = boardTrabajo.columns

  const trabajoTasks = await Promise.all([
    prisma.task.create({
      data: {
        title: 'Preparar presentación trimestral', description: 'Incluir métricas de rendimiento, KPIs del equipo y próximos objetivos.',
        priority: 'high', order: 0, boardId: boardTrabajo.id, columnId: tEnProgreso.id,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        subtasks: { create: [
          { text: 'Recopilar datos de ventas', completed: true },
          { text: 'Diseñar diapositivas', completed: true },
          { text: 'Revisar con el equipo', completed: false },
          { text: 'Ensayar presentación', completed: false },
        ]},
        labels: { create: [{ labelId: trabajo.id }, { labelId: reunion.id }] },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Implementar autenticación OAuth', description: 'Agregar login con Google y GitHub al proyecto principal.',
        priority: 'high', order: 1, boardId: boardTrabajo.id, columnId: tEnProgreso.id,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        subtasks: { create: [
          { text: 'Configurar Google OAuth credentials', completed: true },
          { text: 'Implementar flujo de login', completed: false },
          { text: 'Agregar callback handlers', completed: false },
          { text: 'Testing con múltiples cuentas', completed: false },
        ]},
        labels: { create: [{ labelId: trabajo.id }] },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Revisar pull requests pendientes', description: 'Hay 5 PRs esperando revisión del equipo.',
        priority: 'medium', order: 0, boardId: boardTrabajo.id, columnId: tPorHacer.id,
        labels: { create: [{ labelId: trabajo.id }] },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Reunión semanal con el equipo', description: 'Agenda: progreso sprint, bloqueos, planificación.',
        priority: 'medium', order: 1, boardId: boardTrabajo.id, columnId: tPorHacer.id,
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        labels: { create: [{ labelId: reunion.id }] },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Optimizar consultas de base de datos', description: 'Las queries de la dashboard están tardando más de 3 segundos.',
        priority: 'urgent', order: 0, boardId: boardTrabajo.id, columnId: tBacklog.id,
        dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // overdue
        labels: { create: [{ labelId: urgente.id }, { labelId: trabajo.id }] },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Documentar API endpoints', description: 'Crear documentación Swagger para todos los endpoints públicos.',
        priority: 'low', order: 1, boardId: boardTrabajo.id, columnId: tBacklog.id,
        labels: { create: [{ labelId: trabajo.id }] },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Migrar a TypeScript 5.5', description: 'Actualizar tsconfig y resolver errores de tipos.',
        priority: 'medium', order: 2, boardId: boardTrabajo.id, columnId: tBacklog.id,
        labels: { create: [{ labelId: trabajo.id }] },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Despliegue a producción v2.1', description: 'Release con las nuevas features del sprint.',
        priority: 'high', order: 0, boardId: boardTrabajo.id, columnId: tEnRevision.id,
        subtasks: { create: [
          { text: 'Merge feature branches', completed: true },
          { text: 'Correr tests de integración', completed: true },
          { text: 'Aprobación del tech lead', completed: false },
        ]},
        labels: { create: [{ labelId: trabajo.id }, { labelId: urgente.id }] },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Configurar monitoreo con Datadog', description: 'Setup completo de alertas y dashboards.',
        priority: 'medium', order: 0, boardId: boardTrabajo.id, columnId: tCompletado.id,
        labels: { create: [{ labelId: trabajo.id }] },
      },
    }),
  ])

  // ═══════════════════════════════════════════
  // TASKS (Demo user - Personal board)
  // ═══════════════════════════════════════════
  const [pIdeas, pPlanificado, pHaciendo, pHecho] = boardPersonal.columns

  await Promise.all([
    prisma.task.create({
      data: {
        title: 'Organizar viaje a la montaña', description: 'Planificar excursión de fin de semana con amigos.',
        priority: 'medium', order: 0, boardId: boardPersonal.id, columnId: pPlanificado.id,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        subtasks: { create: [
          { text: 'Reservar cabaña', completed: false },
          { text: 'Comprar provisiones', completed: false },
          { text: 'Confirmar asistentes', completed: true },
        ]},
        labels: { create: [{ labelId: personal.id }] },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Comprar ingredientes para la cena', description: 'Receta de pasta con salsa pesto casera.',
        priority: 'low', order: 0, boardId: boardPersonal.id, columnId: pHaciendo.id,
        dueDate: new Date(Date.now()),
        labels: { create: [{ labelId: personal.id }] },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Renovar membresía del gimnasio', description: 'Vence el próximo mes, considerar plan anual.',
        priority: 'medium', order: 1, boardId: boardPersonal.id, columnId: pPlanificado.id,
        dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        labels: { create: [{ labelId: salud.id }, { labelId: finanzas.id }] },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Investigar cursos de fotografía', description: 'Buscar opciones online y presencial.',
        priority: 'low', order: 0, boardId: boardPersonal.id, columnId: pIdeas.id,
        labels: { create: [{ labelId: ideas.id }] },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Arreglar estante del living', description: 'Comprar tornillos y soportes nuevos.',
        priority: 'low', order: 1, boardId: boardPersonal.id, columnId: pIdeas.id,
        labels: { create: [{ labelId: personal.id }] },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Limpiar y organizar el escritorio', description: 'Ordenar cables, tirar papeles viejos.',
        priority: 'low', order: 0, boardId: boardPersonal.id, columnId: pHecho.id,
        labels: { create: [{ labelId: personal.id }] },
      },
    }),
  ])

  // ═══════════════════════════════════════════
  // TASKS (Demo user - Estudios board)
  // ═══════════════════════════════════════════
  const [ePorEstudiar, eEstudiando, eRepasar, eDominado] = boardEstudios.columns

  await Promise.all([
    prisma.task.create({
      data: {
        title: 'Capítulo 5: Algoritmos de grafos', description: 'BFS, DFS, Dijkstra, Bellman-Ford.',
        priority: 'high', order: 0, boardId: boardEstudios.id, columnId: eEstudiando.id,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        subtasks: { create: [
          { text: 'Leer teoría BFS/DFS', completed: true },
          { text: 'Implementar Dijkstra', completed: false },
          { text: 'Resolver 5 ejercicios LeetCode', completed: false },
        ]},
        labels: { create: [{ labelId: estudio.id }] },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Práctica de SQL avanzado', description: 'Window functions, CTEs, optimización de queries.',
        priority: 'medium', order: 0, boardId: boardEstudios.id, columnId: ePorEstudiar.id,
        labels: { create: [{ labelId: estudio.id }] },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Patrones de diseño en TypeScript', description: 'Singleton, Factory, Observer, Strategy.',
        priority: 'medium', order: 1, boardId: boardEstudios.id, columnId: ePorEstudiar.id,
        labels: { create: [{ labelId: estudio.id }, { labelId: trabajo.id }] },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Docker y contenedores', description: 'Dockerfile, docker-compose, networks, volumes.',
        priority: 'medium', order: 0, boardId: boardEstudios.id, columnId: eRepasar.id,
        labels: { create: [{ labelId: estudio.id }] },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Fundamentos de React', description: 'Hooks, Context, performance, patrones.',
        priority: 'low', order: 0, boardId: boardEstudios.id, columnId: eDominado.id,
        labels: { create: [{ labelId: estudio.id }] },
      },
    }),
  ])

  // ═══════════════════════════════════════════
  // COMMENTS (on some tasks)
  // ═══════════════════════════════════════════
  await Promise.all([
    prisma.comment.create({ data: { text: 'Ya envié los datos al equipo de marketing.', taskId: trabajoTasks[0].id } }),
    prisma.comment.create({ data: { text: 'Pendiente: falta confirmar con el director.', taskId: trabajoTasks[0].id } }),
    prisma.comment.create({ data: { text: 'Encontré un ejemplo en la documentación oficial de Google.', taskId: trabajoTasks[1].id } }),
    prisma.comment.create({ data: { text: 'Importante: la query de usuarios activos es la más lenta.', taskId: trabajoTasks[4].id } }),
    prisma.comment.create({ data: { text: 'Ya indexé las tablas principales, mejora un 40%.', taskId: trabajoTasks[4].id } }),
    prisma.comment.create({ data: { text: 'Tests pasando en staging. Falta aprobación final.', taskId: trabajoTasks[7].id } }),
  ])

  // ═══════════════════════════════════════════
  // FOLDERS + NOTES (Demo user)
  // ═══════════════════════════════════════════
  const folderApuntes = await prisma.folder.create({
    data: { name: 'Apuntes', order: 0, userId: demo.id },
  })
  const folderIdeas = await prisma.folder.create({
    data: { name: 'Ideas de Proyectos', order: 1, userId: demo.id },
  })
  const folderAlgoritmos = await prisma.folder.create({
    data: { name: 'Algoritmos', order: 0, parentId: folderApuntes.id, userId: demo.id },
  })

  await Promise.all([
    prisma.note.create({
      data: {
        title: 'Notas de reunión semanal', userId: demo.id, folderId: null,
        content: '<h2>Reunión 10 de Junio</h2><ul><li>Revisar métricas del sprint anterior</li><li>Planificar próximas features</li><li>Discutir deuda técnica</li></ul><p><strong>Acción:</strong> Carlos se encarga del informe de performance.</p>',
      },
    }),
    prisma.note.create({
      data: {
        title: 'Apuntes: BFS y DFS', userId: demo.id, folderId: folderAlgoritmos.id,
        content: '<h2>BFS (Breadth-First Search)</h2><p>Recorrido por niveles usando una <strong>cola</strong>.</p><h3>Complejidad</h3><ul><li>Tiempo: O(V + E)</li><li>Espacio: O(V)</li></ul><h2>DFS (Depth-First Search)</h2><p>Recorrido en profundidad usando una <strong>pila</strong> o recursión.</p><p>Útil para: detección de ciclos, orden topológico, componentes conexos.</p>',
      },
    }),
    prisma.note.create({
      data: {
        title: 'Idea: App de recetas personalizadas', userId: demo.id, folderId: folderIdeas.id,
        content: '<h2>Concepto</h2><p>Una app que sugiere recetas basándose en los ingredientes que tenés en casa.</p><h3>Features principales</h3><ul><li>Escanear ingredientes con la cámara</li><li>Sugerir recetas por dificultad</li><li>Guardar recetas favoritas</li><li>Lista de compras automática</li></ul><h3>Stack posible</h3><p>React Native + Supabase + OpenAI para sugerencias.</p>',
      },
    }),
    prisma.note.create({
      data: {
        title: 'Lista de libros para leer', userId: demo.id, folderId: null,
        content: '<h2>Técnicos</h2><ol><li>Clean Code - Robert Martin</li><li>Designing Data-Intensive Applications - Martin Kleppmann</li><li>System Design Interview - Alex Xu</li></ol><h2>No ficción</h2><ol><li>Atomic Habits - James Clear</li><li>Deep Work - Cal Newport</li><li>Thinking, Fast and Slow - Daniel Kahneman</li></ol>',
      },
    }),
    prisma.note.create({
      data: {
        title: 'Configuración del entorno de desarrollo', userId: demo.id, folderId: folderApuntes.id,
        content: '<h2>Herramientas</h2><ul><li><strong>Editor:</strong> VS Code con extensiones ESLint, Prettier, GitLens</li><li><strong>Terminal:</strong> iTerm2 + Oh My Zsh</li><li><strong>Node:</strong> v20 LTS via nvm</li><li><strong>DB:</strong> PostgreSQL via Docker</li></ul><h3>Aliases útiles</h3><p><code>alias gs="git status"</code></p><p><code>alias gp="git push"</code></p>',
      },
    }),
  ])

  // ═══════════════════════════════════════════
  // HABITS (Demo user)
  // ═══════════════════════════════════════════
  const habitMeditar = await prisma.habit.create({
    data: {
      name: 'Meditar', habitType: 'boolean', schedule: { type: 'daily' },
      target: 1, unit: '', color: '#8b5cf6', userId: demo.id,
    },
  })
  const habitLeer = await prisma.habit.create({
    data: {
      name: 'Leer', habitType: 'measurable', schedule: { type: 'daily' },
      target: 30, unit: 'páginas', color: '#3b82f6', userId: demo.id,
    },
  })
  const habitEjercicio = await prisma.habit.create({
    data: {
      name: 'Ejercicio', habitType: 'measurable', schedule: { type: 'specific_days', days: [1, 2, 3, 4, 5] },
      target: 45, unit: 'minutos', color: '#22c55e', userId: demo.id,
    },
  })
  const habitAgua = await prisma.habit.create({
    data: {
      name: 'Beber agua', habitType: 'measurable', schedule: { type: 'daily' },
      target: 8, unit: 'vasos', color: '#06b6d4', userId: demo.id,
    },
  })
  const habitCodigo = await prisma.habit.create({
    data: {
      name: 'Escribir código', habitType: 'boolean', schedule: { type: 'times_per_week', times: 5 },
      target: 1, unit: '', color: '#f97316', userId: demo.id,
    },
  })
  const habitDiario = await prisma.habit.create({
    data: {
      name: 'Escribir en el diario', habitType: 'boolean', schedule: { type: 'daily' },
      target: 1, unit: '', color: '#ec4899', userId: demo.id,
    },
  })

  // Generate completions for last 30 days
  const completions: { habitId: string; date: string; value: number }[] = []
  for (let i = 0; i < 30; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const dateStr = date.toISOString().split('T')[0]
    const dayOfWeek = date.getDay() // 0=Sun

    // Meditar: ~80% completion rate
    if (Math.random() < 0.8) {
      completions.push({ habitId: habitMeditar.id, date: dateStr, value: 1 })
    }

    // Leer: variable pages (15-45)
    if (Math.random() < 0.7) {
      completions.push({ habitId: habitLeer.id, date: dateStr, value: Math.floor(15 + Math.random() * 30) })
    }

    // Ejercicio: Mon-Fri, ~70% completion
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && Math.random() < 0.7) {
      completions.push({ habitId: habitEjercicio.id, date: dateStr, value: Math.floor(30 + Math.random() * 30) })
    }

    // Agua: daily, variable (4-10 glasses)
    if (Math.random() < 0.85) {
      completions.push({ habitId: habitAgua.id, date: dateStr, value: Math.floor(4 + Math.random() * 6) })
    }

    // Código: ~70% of days
    if (Math.random() < 0.7) {
      completions.push({ habitId: habitCodigo.id, date: dateStr, value: 1 })
    }

    // Diario: ~60% completion
    if (Math.random() < 0.6) {
      completions.push({ habitId: habitDiario.id, date: dateStr, value: 1 })
    }
  }

  await prisma.habitCompletion.createMany({ data: completions })

  // ═══════════════════════════════════════════
  // OTHER USERS' DATA (boards + some tasks)
  // ═══════════════════════════════════════════
  for (const user of [maria, carlos, lucia, andres]) {
    const board = await prisma.board.create({
      data: {
        name: 'Mi Tablero', color: null, order: 0, userId: user.id,
        columns: {
          create: [
            { title: 'Por Hacer', order: 0 },
            { title: 'En Progreso', order: 1 },
            { title: 'Hecho', order: 2 },
          ],
        },
      },
      include: { columns: true },
    })

    await createLabelsForUser(user.id, board.id)

    const taskTitles = [
      'Revisar correos pendientes',
      'Planificar la semana',
      'Llamar al médico',
      'Actualizar CV',
      'Comprar regalos de cumpleaños',
      'Organizar archivos del drive',
      'Preparar informe mensual',
      'Investigar opciones de inversión',
    ]

    for (let i = 0; i < taskTitles.length; i++) {
      const colIndex = i % 3
      await prisma.task.create({
        data: {
          title: taskTitles[i],
          priority: ['low', 'medium', 'high', 'urgent'][Math.floor(Math.random() * 4)],
          order: Math.floor(i / 3),
          boardId: board.id,
          columnId: board.columns[colIndex].id,
          dueDate: Math.random() > 0.5 ? new Date(Date.now() + (Math.random() * 14 - 3) * 24 * 60 * 60 * 1000) : null,
        },
      })
    }
  }

  console.log('Seed completed successfully!')
  console.log('Demo user: demo@rumbo.app / demo1234')
  console.log('Other users: maria@test.com, carlos@test.com, lucia@test.com, andres@test.com (password: test1234)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
