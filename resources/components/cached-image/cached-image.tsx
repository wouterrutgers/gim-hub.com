import { useState, useEffect, type ReactElement } from "react";
import { useImageContext } from "../../context/image-context";

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
}

export const CachedImage = ({ src, alt, ...props }: CachedImageProps): ReactElement => {
  const { getImageUrlAsync } = useImageContext();
  const [hashedSrc, setHashedSrc] = useState<string | null>(null);

  useEffect(() => {
    void getImageUrlAsync(src).then(setHashedSrc);
  }, [src, getImageUrlAsync]);

  if (!hashedSrc) {
    return <span />;
  }

  return <img {...props} src={hashedSrc} alt={alt} />;
};
