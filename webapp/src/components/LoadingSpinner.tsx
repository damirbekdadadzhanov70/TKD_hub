export default function LoadingSpinner() {
  return (
    <div className="space-y-3 px-4 py-6">
      <div className="h-4 w-3/4 skeleton" />
      <div className="h-4 w-1/2 skeleton" />
      <div className="h-4 w-5/6 skeleton" />
    </div>
  );
}
