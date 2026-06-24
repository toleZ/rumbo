export function WordReveal({ children, className = '', delay = 0 }: {
  children: string
  className?: string
  delay?: number
}) {
  const words = children.split(' ')
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={i} className="word-reveal-wrapper">
          <span
            className="word-reveal-text"
            style={{ animationDelay: `${delay + i * 80}ms` }}
          >
            {i < words.length - 1 ? `${word} ` : word}
          </span>
        </span>
      ))}
    </span>
  )
}
