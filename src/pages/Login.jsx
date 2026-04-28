// Página de login: email/password + Google OAuth
// TODO: formulario de login, botón "Iniciar con Google",
//       enlace a registro, manejo de errores
export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary">
      <div className="glass rounded p-8 w-full max-w-md animate-fade-in">
        <h1 className="font-display text-2xl font-bold text-primary text-center">
          VictoriaEdu
        </h1>
        <p className="text-text-body text-center mt-2">
          Iniciar sesión
        </p>
        {/* TODO: formulario */}
      </div>
    </div>
  )
}
