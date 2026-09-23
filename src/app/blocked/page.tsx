export default function BlockedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center rounded-xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-semibold text-red-800 mb-2">
          Доступ заблокирован
        </h1>
        <p className="text-sm text-red-700">
          Обратитесь к администратору сервиса.
        </p>
      </div>
    </div>
  );
}