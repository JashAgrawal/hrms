import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl"
  showText?: boolean
  href?: string
  className?: string
  textClassName?: string
  imageClassName?: string
}

const sizeConfig = {
  sm: {
    image: "h-6 w-6",
    text: "text-sm font-semibold",
    container: "gap-2"
  },
  md: {
    image: "h-8 w-8",
    text: "text-lg font-semibold",
    container: "gap-2"
  },
  lg: {
    image: "h-12 w-12",
    text: "text-xl font-bold",
    container: "gap-3"
  },
  xl: {
    image: "h-16 w-16",
    text: "text-2xl font-bold",
    container: "gap-4"
  }
}

export function Logo({ 
  size = "md", 
  showText = true, 
  href,
  className,
  textClassName,
  imageClassName
}: LogoProps) {
  const config = sizeConfig[size]
  
  const logoContent = (
    <div className={cn("flex items-center", config.container, className)}>
      <Image
        src="/logo.png"
        alt="Pekka HR Logo"
        width={size === "xl" ? 64 : size === "lg" ? 48 : size === "md" ? 32 : 24}
        height={size === "xl" ? 64 : size === "lg" ? 48 : size === "md" ? 32 : 24}
        className={cn(config.image, imageClassName)}
        priority
      />
      {showText && (
        <span className={cn(config.text, textClassName)}>
          Pekka HR
        </span>
      )}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="flex items-center">
        {logoContent}
      </Link>
    )
  }

  return logoContent
}
