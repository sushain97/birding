import type { SVGProps } from "react";

/** iNaturalist's bird logomark, from the inaturalisticons font in inaturalist/inaturalist. */
export function INaturalistIcon({
  size = 18,
  ...props
}: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="25 22 436 385"
      height={size}
      width={(size * 436) / 385}
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <path
        transform="matrix(1 0 0 -1 0 480)"
        d="M25 414c116-12 208-54 275-127l2-2c3-3 10-11 16-9 5 2 12 14 15 19l0 0c5 8 20 32 51 42 31 10 70-1 72-2l1 0c2-1 5-2 3-4-1-3-15-8-24-25-9-19-15-54-16-62-6-33-19-63-38-88-34-45-85-76-146-82-32-3-64 2-93 14 35 3 77 20 111 59 42 50-4 24-44 31-28 5-51 19-90 68 13 3 37 7 57 8-37 8-85 31-106 67 17 5 40 3 58 3-69 41-98 63-104 90z m163 44l0 0c7-3 66-29 94-68 41-55 43-108 32-96-26 29-51 47-80 67-23 16-38 61-46 97z m212-138c-6 0-10-5-9-10 0-6 5-10 11-9 5 0 9 5 9 10-1 6-6 10-11 9z"
      />
    </svg>
  );
}
