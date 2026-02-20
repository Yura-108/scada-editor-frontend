export default function ValveIcon({size}: {size: number}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
    >
      <line x1="0" y1="50" x2="30" y2="50" stroke="#cfcfcf" strokeWidth="4" />
      <line x1="70" y1="50" x2="100" y2="50" stroke="#cfcfcf" strokeWidth="4" />

      <polygon
        points="30,30 70,50 30,70"
        stroke="#cfcfcf"
        strokeWidth="4"
        fill="none"
      />
    </svg>
  )
}