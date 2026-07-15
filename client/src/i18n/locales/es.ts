/**
 * Traducciones al español (idioma por defecto).
 * Las claves son el texto en inglés: si una clave no existe aquí,
 * la UI muestra el inglés como fallback.
 */
export const es: Record<string, string> = {
  // ── Sidebar ──────────────────────────────────────────────
  'Business Intelligence': 'Business Intelligence',
  'BI Dashboard': 'Panel BI',
  Connectors: 'Conectores',
  General: 'General',
  Dashboard: 'Dashboard',
  Tasks: 'Tareas',
  Apps: 'Aplicaciones',
  Chats: 'Chats',
  Users: 'Usuarios',
  Pages: 'Páginas',
  Auth: 'Autenticación',
  Errors: 'Errores',
  Other: 'Otros',
  Settings: 'Configuración',
  Notifications: 'Notificaciones',
  Account: 'Cuenta',
  Appearance: 'Apariencia',
  Display: 'Pantalla',
  Profile: 'Perfil',
  'Help Center': 'Centro de ayuda',

  // ── Página de conectores ─────────────────────────────────
  'Connect your data sources: APIs, Google Sheets and databases. Credentials are encrypted on the server.':
    'Conecta tus fuentes de datos: APIs, Google Sheets y bases de datos. Las credenciales se cifran en el servidor.',
  'New connector': 'Nuevo conector',
  'The form changes based on the source type.':
    'El formulario cambia según el tipo de fuente.',
  Name: 'Nombre',
  Type: 'Tipo',
  Method: 'Método',
  'Data path': 'Ruta de datos',
  '(optional)': '(opcional)',
  'Headers JSON': 'Headers JSON',
  Range: 'Rango',
  'Service Account Key (JSON)': 'Service Account Key (JSON)',
  Host: 'Host',
  Port: 'Puerto',
  User: 'Usuario',
  Password: 'Contraseña',
  Database: 'Base de datos',
  'Query (SELECT only)': 'Consulta (solo SELECT)',
  'Generate with AI': 'Generar con IA',
  'Generate SQL with AI': 'Generar SQL con IA',
  'Describe what data you want, and AI will generate the SELECT query.':
    'Describe qué datos quieres, y la IA generará la consulta SELECT.',
  'What data do you want?': '¿Qué datos quieres?',
  'e.g., sales by month where amount > 1000, sorted by date desc':
    'ej. ventas por mes donde cantidad > 1000, ordenado por fecha desc',
  'Available columns': 'Columnas disponibles',
  'Generating…': 'Generando…',
  'Generate': 'Generar',
  'Generated Query': 'Consulta Generada',
  'Explanation': 'Explicación',
  'Back': 'Atrás',
  'Accept & Insert': 'Aceptar e Insertar',
  'Create connector': 'Crear conector',
  'Saving…': 'Guardando…',
  Test: 'Probar',
  Delete: 'Eliminar',
  'Created: {{date}}': 'Creado: {{date}}',
  "You don't have connectors yet. Create the first one with the form.":
    'Aún no tienes conectores. Crea el primero con el formulario.',
  'Give the connector a name': 'Ponle un nombre al conector',
  'Connector "{{name}}" created': 'Conector "{{name}}" creado',
  '"{{name}}" connects successfully': '"{{name}}" conecta correctamente',
  '"{{name}}" could not connect': '"{{name}}" no pudo conectar',
  'Connector "{{name}}" deleted': 'Conector "{{name}}" eliminado',
  'Could not load connectors: {{error}}':
    'No se pudieron cargar los conectores: {{error}}',

  // ── Panel BI ─────────────────────────────────────────────
  'Real-time data from your connectors.':
    'Datos en tiempo real desde tus conectores.',
  'Auto-refresh (5s)': 'Auto-actualizar (5s)',
  'Choose a connector': 'Elige un conector',
  '{{total}} records': '{{total}} registros',
  'Chart: {{y}} by {{x}}': 'Gráfica: {{y}} por {{x}}',
  'No numeric columns to chart': 'Sin columnas numéricas para graficar',
  'Updated: {{time}}': 'Actualizado: {{time}}',
  Data: 'Datos',
  'First {{total}} rows': 'Primeras {{total}} filas',
  'No connectors configured. Go to': 'No hay conectores configurados. Ve a',
  'and create the first one.': 'y crea el primero.',
  'Error fetching data: {{error}}': 'Error obteniendo datos: {{error}}',
  'The connector did not return tabular data.':
    'El conector no devolvió datos tabulares.',

  // ── Selector de idioma ───────────────────────────────────
  'Change language': 'Cambiar idioma',

  // ── Páginas de error ─────────────────────────────────────
  'Access Forbidden': 'Acceso prohibido',
  "You don't have necessary permission": 'No tienes el permiso necesario',
  'to view this resource.': 'para ver este recurso.',
  'Go Back': 'Volver',
  'Back to Home': 'Volver al inicio',
  'Oops! Something went wrong': '¡Ups! Algo salió mal',
  'We apologize for the inconvenience.': 'Lamentamos el inconveniente.',
  'Please try again later.': 'Por favor, inténtalo de nuevo más tarde.',
  'Website is under maintenance!': '¡El sitio está en mantenimiento!',
  'The site is not available at the moment.':
    'El sitio no está disponible en este momento.',
  "We'll be back online shortly.": 'Volveremos a estar en línea pronto.',
  'Learn more': 'Más información',
  'Oops! Page Not Found!': '¡Ups! Página no encontrada',
  "It seems like the page you're looking for":
    'Parece que la página que buscas',
  'does not exist or might have been removed.':
    'no existe o pudo haber sido eliminada.',
  'Unauthorized Access': 'Acceso no autorizado',
  'Please log in with the appropriate credentials':
    'Inicia sesión con las credenciales adecuadas',
  'to access this resource.': 'para acceder a este recurso.',

  // ── Dashboard: meses y días (gráficas) ───────────────────
  Jan: 'Ene',
  Feb: 'Feb',
  Mar: 'Mar',
  Apr: 'Abr',
  May: 'May',
  Jun: 'Jun',
  Jul: 'Jul',
  Aug: 'Ago',
  Sep: 'Sep',
  Oct: 'Oct',
  Nov: 'Nov',
  Dec: 'Dic',
  Mon: 'Lun',
  Tue: 'Mar',
  Wed: 'Mié',
  Thu: 'Jue',
  Fri: 'Vie',
  Sat: 'Sáb',
  Sun: 'Dom',

  // ── Dashboard: Overview / Analytics ───────────────────────
  Download: 'Descargar',
  Overview: 'Resumen',
  Analytics: 'Analítica',
  Reports: 'Informes',
  'Total Revenue': 'Ingresos totales',
  '+20.1% from last month': '+20.1% respecto al mes pasado',
  Subscriptions: 'Suscripciones',
  '+180.1% from last month': '+180.1% respecto al mes pasado',
  Sales: 'Ventas',
  '+19% from last month': '+19% respecto al mes pasado',
  'Active Now': 'Activos ahora',
  '+201 since last hour': '+201 desde la última hora',
  'Recent Sales': 'Ventas recientes',
  'You made {{total}} sales this month.':
    'Hiciste {{total}} ventas este mes.',
  Customers: 'Clientes',
  Products: 'Productos',
  'Traffic Overview': 'Resumen de tráfico',
  'Weekly clicks and unique visitors': 'Clics semanales y visitantes únicos',
  'Total Clicks': 'Clics totales',
  '+12.4% vs last week': '+12.4% frente a la semana pasada',
  'Unique Visitors': 'Visitantes únicos',
  '+5.8% vs last week': '+5.8% frente a la semana pasada',
  'Bounce Rate': 'Tasa de rebote',
  '-3.2% vs last week': '-3.2% frente a la semana pasada',
  'Avg. Session': 'Sesión prom.',
  '+18s vs last week': '+18s frente a la semana pasada',
  Referrers: 'Referentes',
  'Top sources driving traffic': 'Principales fuentes de tráfico',
  Direct: 'Directo',
  Blog: 'Blog',
  Devices: 'Dispositivos',
  'How users access your app': 'Cómo acceden los usuarios a tu app',
  Desktop: 'Escritorio',
  Mobile: 'Móvil',
  Tablet: 'Tablet',

  // ── Autenticación ─────────────────────────────────────────
  'Sign in': 'Iniciar sesión',
  'Enter your email and password below to log into':
    'Ingresa tu correo y contraseña a continuación para acceder a',
  'your account.': 'tu cuenta.',
  "Don't have an account?": '¿No tienes una cuenta?',
  'Sign Up': 'Regístrate',
  'By clicking sign in, you agree to our':
    'Al iniciar sesión, aceptas nuestros',
  'Terms of Service': 'Términos de Servicio',
  and: 'y',
  'Privacy Policy': 'Política de Privacidad',
  Email: 'Correo electrónico',
  'Please enter your email.': 'Por favor ingresa tu correo.',
  'Please enter your password.': 'Por favor ingresa tu contraseña.',
  'Password must be at least 7 characters long.':
    'La contraseña debe tener al menos 7 caracteres.',
  'Forgot password?': '¿Olvidaste tu contraseña?',
  'Signing in...': 'Iniciando sesión...',
  'Welcome back, {{email}}!': '¡Bienvenido de nuevo, {{email}}!',
  Error: 'Error',
  'Or continue with': 'O continúa con',
  'Create an account': 'Crear una cuenta',
  'Enter your email and password to create an account.':
    'Ingresa tu correo y contraseña para crear una cuenta.',
  'Already have an account?': '¿Ya tienes una cuenta?',
  'Sign In': 'Iniciar sesión',
  'By creating an account, you agree to our':
    'Al crear una cuenta, aceptas nuestros',
  'Please confirm your password.': 'Por favor confirma tu contraseña.',
  "Passwords don't match.": 'Las contraseñas no coinciden.',
  'Confirm Password': 'Confirmar contraseña',
  'Creating account...': 'Creando cuenta...',
  'Account created for {{email}}.': 'Cuenta creada para {{email}}.',
  'Create Account': 'Crear cuenta',
  'Forgot Password': 'Contraseña olvidada',
  'Enter your registered email and': 'Ingresa tu correo registrado y',
  'we will send you a link to reset your password.':
    'te enviaremos un enlace para restablecer tu contraseña.',
  'Sign up': 'Regístrate',
  'Two-factor Authentication': 'Autenticación de dos factores',
  'Please enter the authentication code.':
    'Por favor ingresa el código de autenticación.',
  'We have sent the authentication code to your email.':
    'Hemos enviado el código de autenticación a tu correo.',
  "Haven't received it?": '¿No lo has recibido?',
  'Resend a new code.': 'Reenviar un nuevo código.',
  'Please enter the 6-digit code.': 'Por favor ingresa el código de 6 dígitos.',
  'One-Time Password': 'Contraseña de un solo uso',
  Verify: 'Verificar',
  'Sending email...': 'Enviando correo...',
  'Email sent to {{email}}': 'Correo enviado a {{email}}',
  Continue: 'Continuar',

  // ── Settings ──────────────────────────────────────────────
  'Select a settings section': 'Elige una sección',
  'Manage your account settings and set e-mail preferences.':
    'Administra la configuración de tu cuenta y las preferencias de correo.',
  'Update your account settings.': 'Actualiza la configuración de tu cuenta.',
  'Your name': 'Tu nombre',
  'This is the name that will be displayed on your profile and in emails.':
    'Este es el nombre que se mostrará en tu perfil y en los correos.',
  'Date of birth': 'Fecha de nacimiento',
  'Your date of birth is used to calculate your age.':
    'Tu fecha de nacimiento se usa para calcular tu edad.',
  'Please enter your name.': 'Por favor ingresa tu nombre.',
  'Name must be at least 2 characters.':
    'El nombre debe tener al menos 2 caracteres.',
  'Name must not be longer than 30 characters.':
    'El nombre no puede tener más de 30 caracteres.',
  'Please select your date of birth.':
    'Por favor selecciona tu fecha de nacimiento.',
  'Update account': 'Actualizar cuenta',
  'Customize the appearance of the app. Automatically switch between day and night themes.':
    'Personaliza la apariencia de la app. Cambia automáticamente entre temas claro y oscuro.',
  Font: 'Fuente',
  'Set the font you want to use in the dashboard.':
    'Elige la fuente que quieres usar en el panel.',
  'Select the theme for the dashboard.': 'Elige el tema para el panel.',
  Light: 'Claro',
  Dark: 'Oscuro',
  System: 'Sistema',
  'Toggle theme': 'Cambiar tema',
  'Update preferences': 'Actualizar preferencias',
  "Turn items on or off to control what's displayed in the app.":
    'Activa o desactiva elementos para controlar qué se muestra en la app.',
  'You have to select at least one item.':
    'Debes seleccionar al menos un elemento.',
  Recents: 'Recientes',
  Home: 'Inicio',
  Applications: 'Aplicaciones',
  Downloads: 'Descargas',
  Documents: 'Documentos',
  Sidebar: 'Barra lateral',
  'Select the items you want to display in the sidebar.':
    'Elige los elementos que quieres mostrar en la barra lateral.',
  'Update display': 'Actualizar pantalla',
  'Configure how you receive notifications.':
    'Configura cómo recibes las notificaciones.',
  'Please select a notification type.':
    'Por favor selecciona un tipo de notificación.',
  'Notify me about...': 'Notificarme sobre...',
  'All new messages': 'Todos los mensajes nuevos',
  'Direct messages and mentions': 'Mensajes directos y menciones',
  Nothing: 'Nada',
  'Email Notifications': 'Notificaciones por correo',
  'Communication emails': 'Correos de comunicación',
  'Receive emails about your account activity.':
    'Recibe correos sobre la actividad de tu cuenta.',
  'Marketing emails': 'Correos de marketing',
  'Receive emails about new products, features, and more.':
    'Recibe correos sobre nuevos productos, funciones y más.',
  'Social emails': 'Correos sociales',
  'Receive emails for friend requests, follows, and more.':
    'Recibe correos por solicitudes de amistad, seguidores y más.',
  'Security emails': 'Correos de seguridad',
  'Receive emails about your account activity and security.':
    'Recibe correos sobre la actividad y seguridad de tu cuenta.',
  'Use different settings for my mobile devices':
    'Usar configuración diferente para mis dispositivos móviles',
  'You can manage your mobile notifications in the':
    'Puedes administrar tus notificaciones móviles en la',
  'mobile settings': 'configuración móvil',
  'page.': 'página.',
  'Update notifications': 'Actualizar notificaciones',
  'This is how others will see you on the site.':
    'Así es como otros te verán en el sitio.',
  Username: 'Nombre de usuario',
  'Please enter your username.': 'Por favor ingresa tu nombre de usuario.',
  'Username must be at least 2 characters.':
    'El nombre de usuario debe tener al menos 2 caracteres.',
  'Username must not be longer than 30 characters.':
    'El nombre de usuario no puede tener más de 30 caracteres.',
  'Please select an email to display.':
    'Por favor selecciona un correo para mostrar.',
  'Please enter a valid URL.': 'Por favor ingresa una URL válida.',
  'This is your public display name. It can be your real name or a pseudonym. You can only change this once every 30 days.':
    'Este es tu nombre público. Puede ser tu nombre real o un seudónimo. Solo puedes cambiarlo una vez cada 30 días.',
  'Select a verified email to display':
    'Selecciona un correo verificado para mostrar',
  'You can manage verified email addresses in your':
    'Puedes administrar tus correos verificados en tu',
  'email settings': 'configuración de correo',
  Bio: 'Biografía',
  'Tell us a little bit about yourself': 'Cuéntanos un poco sobre ti',
  'You can': 'Puedes',
  'other users and organizations to link to them.':
    'a otros usuarios y organizaciones para enlazarlos.',
  URLs: 'URLs',
  'Add links to your website, blog, or social media profiles.':
    'Agrega enlaces a tu sitio web, blog o redes sociales.',
  'Add URL': 'Agregar URL',
  'Update profile': 'Actualizar perfil',

  // ── Apps ──────────────────────────────────────────────────
  'All Apps': 'Todas las apps',
  Connected: 'Conectado',
  'Not Connected': 'No conectado',
  'App Integrations': 'Integraciones de apps',
  "Here's a list of your apps for the integration!":
    '¡Aquí tienes la lista de tus apps para la integración!',
  'Filter apps...': 'Filtrar apps...',
  Ascending: 'Ascendente',
  Descending: 'Descendente',
  Connect: 'Conectar',
  'Connect with Telegram for real-time communication.':
    'Conéctate con Telegram para comunicación en tiempo real.',
  'Effortlessly sync Notion pages for seamless collaboration.':
    'Sincroniza páginas de Notion sin esfuerzo para una colaboración fluida.',
  'View and collaborate on Figma designs in one place.':
    'Visualiza y colabora en diseños de Figma en un solo lugar.',
  'Sync Trello cards for streamlined project management.':
    'Sincroniza tarjetas de Trello para una gestión de proyectos simplificada.',
  'Integrate Slack for efficient team communication':
    'Integra Slack para una comunicación de equipo eficiente',
  'Host Zoom meetings directly from the dashboard.':
    'Organiza reuniones de Zoom directamente desde el panel.',
  'Easily manage Stripe transactions and payments.':
    'Administra fácilmente transacciones y pagos de Stripe.',
  'Access and manage Gmail messages effortlessly.':
    'Accede y gestiona mensajes de Gmail sin esfuerzo.',
  'Explore and share Medium stories on your dashboard.':
    'Explora y comparte historias de Medium en tu panel.',
  'Connect with Skype contacts seamlessly.':
    'Conéctate con tus contactos de Skype sin problemas.',
  'Effortlessly manage Docker containers on your dashboard.':
    'Administra contenedores de Docker sin esfuerzo desde tu panel.',
  'Streamline code management with GitHub integration.':
    'Simplifica la gestión de código con la integración de GitHub.',
  'Efficiently manage code projects with GitLab integration.':
    'Gestiona proyectos de código eficientemente con la integración de GitLab.',
  'Connect with Discord for seamless team communication.':
    'Conéctate con Discord para una comunicación de equipo fluida.',
  'Easily integrate WhatsApp for direct messaging.':
    'Integra fácilmente WhatsApp para mensajería directa.',

  // ── Chats ─────────────────────────────────────────────────
  Inbox: 'Bandeja de entrada',
  Search: 'Buscar',
  'Search chat...': 'Buscar chat...',
  You: 'Tú',
  'Chat Text Box': 'Cuadro de texto del chat',
  'Type your messages...': 'Escribe tus mensajes...',
  Send: 'Enviar',
  'Your messages': 'Tus mensajes',
  'Send a message to start a chat.': 'Envía un mensaje para iniciar un chat.',
  'Send message': 'Enviar mensaje',
  'New message': 'Nuevo mensaje',
  'To:': 'Para:',
  'Search people...': 'Buscar personas...',
  'No people found.': 'No se encontraron personas.',
  Chat: 'Chatear',

  // ── Data table (compartido: Tasks / Users) ───────────────
  Asc: 'Ascendente',
  Desc: 'Descendente',
  Hide: 'Ocultar',
  '{{n}} selected': '{{n}} seleccionados',
  'No results found.': 'No se encontraron resultados.',
  'Clear filters': 'Limpiar filtros',
  'Page {{current}} of {{total}}': 'Página {{current}} de {{total}}',
  'Rows per page': 'Filas por página',
  'Go to first page': 'Ir a la primera página',
  'Go to previous page': 'Ir a la página anterior',
  'Go to page {{n}}': 'Ir a la página {{n}}',
  'Go to next page': 'Ir a la página siguiente',
  'Go to last page': 'Ir a la última página',
  'Filter...': 'Filtrar...',
  Reset: 'Restablecer',
  View: 'Vista',
  'Toggle columns': 'Mostrar/ocultar columnas',
  task: 'tarea',
  user: 'usuario',
  selected: 'seleccionados',
  'You selected {{n}} {{entity}}. Bulk actions toolbar is available.':
    'Seleccionaste {{n}} {{entity}}. La barra de acciones masivas está disponible.',
  'Bulk actions for {{n}} {{entity}}':
    'Acciones masivas para {{n}} {{entity}}',
  'Clear selection': 'Limpiar selección',
  'Clear selection (Escape)': 'Limpiar selección (Escape)',

  // ── Tasks ─────────────────────────────────────────────────
  "Here's a list of your tasks for this month!":
    '¡Aquí tienes la lista de tus tareas de este mes!',
  Import: 'Importar',
  Create: 'Crear',
  'Select all': 'Seleccionar todo',
  'Select row': 'Seleccionar fila',
  Task: 'Tarea',
  Title: 'Título',
  Status: 'Estado',
  Priority: 'Prioridad',
  Bug: 'Error',
  Feature: 'Función',
  Documentation: 'Documentación',
  Backlog: 'Pendiente',
  Todo: 'Por hacer',
  'In Progress': 'En progreso',
  Done: 'Hecho',
  Canceled: 'Cancelado',
  Low: 'Baja',
  Medium: 'Media',
  High: 'Alta',
  Critical: 'Crítica',
  'Filter by title or ID...': 'Filtrar por título o ID...',
  'No results.': 'Sin resultados.',
  'Open menu': 'Abrir menú',
  Edit: 'Editar',
  'Make a copy': 'Hacer una copia',
  Favorite: 'Favorito',
  Labels: 'Etiquetas',
  'Update status': 'Actualizar estado',
  'Update priority': 'Actualizar prioridad',
  'Export tasks': 'Exportar tareas',
  'Delete selected tasks': 'Eliminar tareas seleccionadas',
  'Updating status...': 'Actualizando estado...',
  'Status updated to "{{status}}" for {{n}} task(s).':
    'Estado actualizado a "{{status}}" para {{n}} tarea(s).',
  'Updating priority...': 'Actualizando prioridad...',
  'Priority updated to "{{priority}}" for {{n}} task(s).':
    'Prioridad actualizada a "{{priority}}" para {{n}} tarea(s).',
  'Exporting tasks...': 'Exportando tareas...',
  'Exported {{n}} task(s) to CSV.': 'Se exportaron {{n}} tarea(s) a CSV.',
  'The following task has been deleted:': 'Se eliminó la siguiente tarea:',
  'Delete this task: {{id}} ?': '¿Eliminar esta tarea: {{id}}?',
  'You are about to delete a task with the ID':
    'Estás a punto de eliminar una tarea con el ID',
  'This action cannot be undone.': 'Esta acción no se puede deshacer.',
  'Please upload a file.': 'Por favor sube un archivo.',
  'Please upload csv format.': 'Por favor sube un archivo en formato CSV.',
  'You have imported the following file:':
    'Has importado el siguiente archivo:',
  'Import Tasks': 'Importar tareas',
  'Import tasks quickly from a CSV file.':
    'Importa tareas rápidamente desde un archivo CSV.',
  File: 'Archivo',
  Close: 'Cerrar',
  'Please type "{{word}}" to confirm.': 'Escribe "{{word}}" para confirmar.',
  'Deleting tasks...': 'Eliminando tareas...',
  'Deleted {{n}} task(s)': 'Se eliminaron {{n}} tarea(s)',
  'Delete {{n}} task(s)': 'Eliminar {{n}} tarea(s)',
  'Are you sure you want to delete the selected tasks?':
    '¿Seguro que quieres eliminar las tareas seleccionadas?',
  'Confirm by typing "{{word}}":': 'Confirma escribiendo "{{word}}":',
  'Warning!': '¡Advertencia!',
  'Please be careful, this operation can not be rolled back.':
    'Ten cuidado, esta operación no se puede deshacer.',
  'Title is required.': 'El título es obligatorio.',
  'Please select a status.': 'Por favor selecciona un estado.',
  'Please select a label.': 'Por favor selecciona una etiqueta.',
  'Please choose a priority.': 'Por favor elige una prioridad.',
  'Update Task': 'Actualizar tarea',
  'Create Task': 'Crear tarea',
  'Update the task by providing necessary info.':
    'Actualiza la tarea proporcionando la información necesaria.',
  'Add a new task by providing necessary info.':
    'Agrega una nueva tarea proporcionando la información necesaria.',
  "Click save when you're done.": 'Haz clic en guardar cuando termines.',
  'Enter a title': 'Ingresa un título',
  'Select dropdown': 'Selecciona una opción',
  Label: 'Etiqueta',
  'Save changes': 'Guardar cambios',

  // ── Users ─────────────────────────────────────────────────
  'User List': 'Lista de usuarios',
  'Manage your users and their roles here.':
    'Administra tus usuarios y sus roles aquí.',
  'Invite User': 'Invitar usuario',
  'Add User': 'Agregar usuario',
  'Phone Number': 'Número de teléfono',
  Role: 'Rol',
  active: 'activo',
  inactive: 'inactivo',
  invited: 'invitado',
  suspended: 'suspendido',
  superadmin: 'superadministrador',
  admin: 'administrador',
  manager: 'gerente',
  cashier: 'cajero',
  Active: 'Activo',
  Inactive: 'Inactivo',
  Invited: 'Invitado',
  Suspended: 'Suspendido',
  Superadmin: 'Superadministrador',
  Admin: 'Administrador',
  Manager: 'Gerente',
  Cashier: 'Cajero',
  'Filter users...': 'Filtrar usuarios...',
  'Activating users...': 'Activando usuarios...',
  'Deactivating users...': 'Desactivando usuarios...',
  '{{n}} user(s) activated': '{{n}} usuario(s) activado(s)',
  '{{n}} user(s) deactivated': '{{n}} usuario(s) desactivado(s)',
  'Error activating users': 'Error al activar usuarios',
  'Error deactivating users': 'Error al desactivar usuarios',
  'Inviting users...': 'Invitando usuarios...',
  '{{n}} user(s) invited': '{{n}} usuario(s) invitado(s)',
  'Error inviting users': 'Error al invitar usuarios',
  'Invite selected users': 'Invitar usuarios seleccionados',
  'Activate selected users': 'Activar usuarios seleccionados',
  'Deactivate selected users': 'Desactivar usuarios seleccionados',
  'Delete selected users': 'Eliminar usuarios seleccionados',
  'First Name is required.': 'El nombre es obligatorio.',
  'Last Name is required.': 'El apellido es obligatorio.',
  'Username is required.': 'El nombre de usuario es obligatorio.',
  'Phone number is required.': 'El número de teléfono es obligatorio.',
  'Email is required.': 'El correo es obligatorio.',
  'Password is required.': 'La contraseña es obligatoria.',
  'Password must be at least 8 characters long.':
    'La contraseña debe tener al menos 8 caracteres.',
  'Password must contain at least one lowercase letter.':
    'La contraseña debe contener al menos una letra minúscula.',
  'Password must contain at least one number.':
    'La contraseña debe contener al menos un número.',
  'Edit User': 'Editar usuario',
  'Add New User': 'Agregar nuevo usuario',
  'Update the user here.': 'Actualiza el usuario aquí.',
  'Create new user here.': 'Crea un nuevo usuario aquí.',
  'First Name': 'Nombre',
  'Last Name': 'Apellido',
  'Select a role': 'Selecciona un rol',
  'The following user has been deleted:': 'Se eliminó el siguiente usuario:',
  'Delete User': 'Eliminar usuario',
  'Are you sure you want to delete':
    '¿Seguro que quieres eliminar a',
  'This action will permanently remove the user with the role of':
    'Esta acción eliminará permanentemente al usuario con el rol de',
  'from the system. This cannot be undone.':
    'del sistema. Esto no se puede deshacer.',
  'Username:': 'Nombre de usuario:',
  'Enter username to confirm deletion.':
    'Ingresa el nombre de usuario para confirmar la eliminación.',
  'Please enter an email to invite.':
    'Por favor ingresa un correo para invitar.',
  'Description (optional)': 'Descripción (opcional)',
  'Add a personal note to your invitation (optional)':
    'Agrega una nota personal a tu invitación (opcional)',
  Cancel: 'Cancelar',
  Invite: 'Invitar',
  'Deleting users...': 'Eliminando usuarios...',
  'Deleted {{n}} user(s)': 'Se eliminaron {{n}} usuario(s)',
  'Delete {{n}} user(s)': 'Eliminar {{n}} usuario(s)',
  'Are you sure you want to delete the selected users?':
    '¿Seguro que quieres eliminar los usuarios seleccionados?',
  'Invite new user to join your team by sending them an email invitation. Assign a role to define their access level.':
    'Invita a un nuevo usuario a unirse a tu equipo enviándole una invitación por correo. Asigna un rol para definir su nivel de acceso.',

  // ── Dashboard builder (widgets) ───────────────────────────
  'Build your own dashboard: add widgets from your connectors.':
    'Crea tu propio dashboard: agrega widgets desde tus conectores.',
  'This dashboard has no widgets yet. Click "Add widget" to create the first one.':
    'Este dashboard aún no tiene widgets. Haz clic en "Agregar widget" para crear el primero.',
  'Delete widget "{{title}}"?': '¿Eliminar el widget "{{title}}"?',
  'Widget deleted': 'Widget eliminado',
  'Widget options': 'Opciones del widget',
  'No data yet.': 'Aún no hay datos.',
  'Give the widget a title and choose a connector':
    'Ponle un título al widget y elige un conector',
  'Widget updated': 'Widget actualizado',
  'Widget added': 'Widget agregado',
  'Edit widget': 'Editar widget',
  'Add widget': 'Agregar widget',
  'Edit layout': 'Editar diseño',
  'Save layout': 'Guardar diseño',
  'Sales by month': 'Ventas por mes',
  Connector: 'Conector',
  'Chart type': 'Tipo de gráfica',
  'Bar chart': 'Gráfica de barras',
  'Line chart': 'Gráfica de línea',
  'Area chart': 'Gráfica de área',
  'Pie chart': 'Gráfica de torta',
  Table: 'Tabla',
  'X axis column': 'Columna del eje X',
  'Y axis column': 'Columna del eje Y',
  'Auto-detect': 'Detectar automáticamente',
  Save: 'Guardar',
  'Dashboard "{{name}}" created': 'Dashboard "{{name}}" creado',
  'Dashboard renamed': 'Dashboard renombrado',
  'Delete dashboard "{{name}}"? This cannot be undone.':
    '¿Eliminar el dashboard "{{name}}"? Esto no se puede deshacer.',
  'Dashboard deleted': 'Dashboard eliminado',
  'Choose a dashboard': 'Elige un dashboard',
  'Delete dashboard': 'Eliminar dashboard',
  'New dashboard': 'Nuevo dashboard',
  'Dashboard name': 'Nombre del dashboard',

  // ── Copiloto de IA ────────────────────────────────────────
  'Describe the widget you want, e.g. "sales by month as a line chart"':
    'Describe el widget que quieres, ej. "ventas por mes en gráfica de línea"',
  'Generate with AI': 'Generar con IA',
  'Generating…': 'Generando…',

  // ── Nuevos tipos de widget (KPI, calendario, reloj, filtros) ──────
  'Widget type': 'Tipo de widget',
  Chart: 'Gráfica',
  'KPI card': 'Tarjeta KPI',
  Calendar: 'Calendario',
  Clock: 'Reloj',
  'Date filter': 'Filtro de fecha',
  'Selection filter': 'Filtro de selección',
  'Give the widget a title': 'Ponle un título al widget',
  'This widget type requires a connector':
    'Este tipo de widget requiere un conector',
  'Give the filter a target column': 'Dale al filtro una columna objetivo',
  None: 'Ninguno',
  'Column to aggregate': 'Columna a agregar',
  'e.g. total_millones': 'ej. total_millones',
  Aggregation: 'Agregación',
  Sum: 'Suma',
  Average: 'Promedio',
  Count: 'Conteo',
  Minimum: 'Mínimo',
  Maximum: 'Máximo',
  'Date column to highlight': 'Columna de fecha a resaltar',
  'e.g. created_at': 'ej. created_at',
  'Target column': 'Columna objetivo',
  'Widgets on this dashboard that share this column will be filtered automatically.':
    'Los widgets de este dashboard que compartan esta columna se filtrarán automáticamente.',
  '{{n}} of {{total}} rows': '{{n}} de {{total}} filas',
  'No rows match the active filters.':
    'Ninguna fila coincide con los filtros activos.',
  'This filter has no target column configured.':
    'Este filtro no tiene una columna objetivo configurada.',
  'Select a date range': 'Selecciona un rango de fechas',
  'Clear filter': 'Limpiar filtro',
  'Filters column "{{column}}"': 'Filtra la columna "{{column}}"',
  All: 'Todos',
  "Could not detect this connector's columns; type the column name manually.":
    'No se pudieron detectar las columnas de este conector; escribe el nombre de la columna manualmente.',

  // ── Edición de widgets con IA ─────────────────────────────
  'Edit with AI': 'Editar con IA',
  'Edit "{{title}}" with AI': 'Editar "{{title}}" con IA',
  'Describe what to change, e.g. "switch to a pie chart"':
    'Describe qué quieres cambiar, ej. "cámbiala a gráfica de torta"',

  // ── Tableros: Favoritos / Explorar ────────────────────────
  Favorites: 'Favoritos',
  Explore: 'Explorar',
  'No favorites yet. Star a dashboard in "Explore" to pin it here.':
    'Aún no tienes favoritos. Marca un tablero con la estrella en "Explorar" para anclarlo aquí.',
  'Search dashboards or tags…': 'Buscar tableros o etiquetas…',
  'No dashboards match your search.':
    'Ningún tablero coincide con tu búsqueda.',
  'Remove from favorites': 'Quitar de favoritos',
  'Add to favorites': 'Agregar a favoritos',
  'Edit dashboard': 'Editar tablero',
  'Dashboard updated': 'Tablero actualizado',
  'Tags, comma-separated (optional)':
    'Etiquetas separadas por coma (opcional)',

  // ── Colores y nuevos tipos de widget (Fase visual) ────────
  Color: 'Color',
  Default: 'Predeterminado',
  Pink: 'Rosa',
  Blue: 'Azul',
  Green: 'Verde',
  Orange: 'Naranja',
  Purple: 'Morado',
  Teal: 'Turquesa',
  'Combined chart': 'Gráfica combinada',
  'Progress bars': 'Barras de progreso',
  Map: 'Mapa',
  'Label column': 'Columna de etiqueta',
  'Value column': 'Columna de valor',
  'Region column (country)': 'Columna de región (país)',
  'No matching regions. The region column should hold country names.':
    'Sin regiones coincidentes. La columna de región debe contener nombres de países.',
}
