import type { ElementType, ComponentPropsWithRef } from 'react'

type CardProps<T extends ElementType = 'div'> = {
  as?: T
  className?: string
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className'>

export function Card<T extends ElementType = 'div'>({
  as,
  className,
  ...props
}: CardProps<T>) {
  const Tag: ElementType = as ?? 'div'
  return (
    <Tag
      className={`card bg-base-100 shadow-sm border border-base-200 ${className ?? ''}`}
      {...props}
    />
  )
}

type SlotProps = {
  className?: string
  children?: React.ReactNode
}

export function CardHeader({ className, children }: SlotProps) {
  return (
    <div
      className={`px-4 py-3 border-b border-base-200 flex items-center gap-2 ${className ?? ''}`}
    >
      {children}
    </div>
  )
}

export function CardBody({ className, children }: SlotProps) {
  return <div className={`card-body p-4 ${className ?? ''}`}>{children}</div>
}

export function CardFooter({ className, children }: SlotProps) {
  return (
    <div
      className={`px-4 py-3 border-t border-base-200 flex items-center gap-2 ${className ?? ''}`}
    >
      {children}
    </div>
  )
}
