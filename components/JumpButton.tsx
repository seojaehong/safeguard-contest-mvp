"use client";

interface JumpButtonProps {
  id: string;
  children: React.ReactNode;
}

export function JumpButton({ id, children }: JumpButtonProps) {
  function handleClick() {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <button type="button" onClick={handleClick}>
      {children}
    </button>
  );
}
