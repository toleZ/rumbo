import { Fragment, useEffect, useRef } from 'react'

export function WordReveal({ children, className = '', delay = 0, startOnVisible = false, textClassName = '', style }: {
  children: string
  className?: string
  delay?: number
  /** Hold the per-word animation paused until the text scrolls into view. */
  startOnVisible?: boolean
  /** Extra classes for the animated word spans themselves — needed for
      background-clip:text effects, which don't clip through child spans
      when applied to the outer wrapper. */
  textClassName?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!startOnVisible) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.remove('word-reveal-pending')
          io.disconnect()
        }
      },
      { threshold: 0.5 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [startOnVisible])

  const words = children.split(' ')
  return (
    <span ref={ref} className={`${startOnVisible ? 'word-reveal-pending' : ''} ${className}`} style={style}>
      {words.map((word, i) => (
        // The separating space lives OUTSIDE the overflow-hidden inline-block
        // wrapper: trailing whitespace inside an inline-block is trimmed by
        // CSS text processing, which would fuse the words together.
        <Fragment key={i}>
          <span className="word-reveal-wrapper">
            <span
              className={`word-reveal-text ${textClassName}`}
              style={{ animationDelay: `${delay + i * 80}ms` }}
            >
              {word}
            </span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </span>
  )
}
