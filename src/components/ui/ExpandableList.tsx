import * as React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from './Button'

interface ExpandableListProps<T> {
  items: T[]
  initialVisibleCount: number
  getKey: (item: T, index: number) => React.Key
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  buttonClassName?: string
  collapsedLabel?: (hiddenCount: number) => string
  expandedLabel?: string
}

export function ExpandableList<T>({
  items,
  initialVisibleCount,
  getKey,
  renderItem,
  className,
  buttonClassName,
  collapsedLabel = (hiddenCount) => `展开剩余 ${hiddenCount} 项`,
  expandedLabel = '收起目录',
}: ExpandableListProps<T>) {
  const [expanded, setExpanded] = React.useState(false)

  React.useEffect(() => {
    setExpanded(false)
  }, [items.length])

  const visibleItems = expanded ? items : items.slice(0, initialVisibleCount)
  const hiddenCount = Math.max(0, items.length - visibleItems.length)
  const isExpandable = items.length > initialVisibleCount

  return (
    <>
      <div className={className}>
        {visibleItems.map((item, index) => (
          <React.Fragment key={getKey(item, index)}>
            {renderItem(item, index)}
          </React.Fragment>
        ))}
      </div>
      {isExpandable && (
        <div className="mt-3 flex justify-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExpanded((prev) => !prev)}
            className={buttonClassName}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                {expandedLabel}
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                {collapsedLabel(hiddenCount)}
              </>
            )}
          </Button>
        </div>
      )}
    </>
  )
}
