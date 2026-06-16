"use client";

import { Switch } from "@/components/ui/Switch";

interface Props {
  isPublic: boolean;
  isListed: boolean;
  onPublicChange: (value: boolean) => void;
  onListedChange: (value: boolean) => void;
  publicLabel?: string;
  listedLabel?: string;
}

export function VisibilityFieldset({
  isPublic,
  isListed,
  onPublicChange,
  onListedChange,
  publicLabel = "Public",
  listedLabel = "Listed on board index",
}: Props) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 text-sm font-medium text-gray-700">Visibility</legend>

      <div className="flex items-center justify-between gap-4">
        <span id="board-public-label" className="text-sm text-gray-700">
          {publicLabel}
        </span>
        <Switch
          checked={isPublic}
          aria-labelledby="board-public-label"
          onCheckedChange={(checked) => {
            onPublicChange(checked);
            if (!checked) onListedChange(false);
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <span id="board-listed-label" className="text-sm text-gray-700">
          {listedLabel}
        </span>
        <Switch
          checked={isListed}
          disabled={!isPublic}
          aria-labelledby="board-listed-label"
          onCheckedChange={onListedChange}
        />
      </div>
    </fieldset>
  );
}
