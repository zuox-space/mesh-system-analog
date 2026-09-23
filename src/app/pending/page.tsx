export default function PendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center rounded-xl border border-blue-200 bg-blue-50 p-6">
        <h1 className="text-lg font-semibold text-blue-800 mb-2">
          Аккаунт ожидает подтверждения
        </h1>
        <p className="text-sm text-blue-700">
          Ваша заявка отправлена. Администратор активирует доступ в ближайшее время.
        </p>
      </div>
    </div>
  );
}