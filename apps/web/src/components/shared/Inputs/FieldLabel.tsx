interface FieldLabelProps {
  title?: string;
  caption?: string;
  required?: boolean;
}

export function FieldLabel({ title, caption, required }: FieldLabelProps) {
  return (
    <span className="flex flex-col gap-0.5 py-1">
      {title && (
        <span>
          {title}
          {required && <span className="text-error ml-1">*</span>}
        </span>
      )}
      {caption && <span className="text-gray-500 text-xs font-normal">{caption}</span>}
    </span>
  );
}
