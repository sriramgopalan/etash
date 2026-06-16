import { Search } from "lucide-react";

interface Props {
  action: string;
  defaultValue?: string;
}

export function BoardSearch({ action, defaultValue }: Props) {
  return (
    <form action={action} method="get" role="search" className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        aria-hidden="true"
      />
      <input
        type="search"
        name="search"
        defaultValue={defaultValue}
        placeholder="Search boards..."
        aria-label="Search boards"
        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </form>
  );
}
