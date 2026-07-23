'use client'

import Image from 'next/image'
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { IArticle } from '@/interfaces/article'
import {
  ARTICLE_TEASER_CLIP_SECONDS,
  articleVideoSrc,
} from '@/lib/helpers/article-video-src'
import { articleImageSrc, isDataUri } from '@/lib/helpers/image-src'

export type ArticleLeadMediaMode = 'teaser' | 'full' | 'preview-frame'

interface IArticleLeadMediaProps {
  article: Pick<IArticle, 'id' | 'title' | 'slug' | 'thumbnailUrl' | 'videoUrl' | 'summary'>
  mode?: ArticleLeadMediaMode
  /** Teaser only: keep thumbnail visible behind a smaller looping clip. */
  teaserOverlay?: boolean
  /** Full only: start playback unmuted (e.g. Live carousel selection). */
  autoPlayUnmuted?: boolean
  /** Full only: bump to re-trigger unmuted play for the same clip. */
  playbackNonce?: number
  className?: string
  imageSizes?: string
  priority?: boolean
}

function playVideoSafely(video: HTMLVideoElement, context: string): void {
  void video.play().catch((error: unknown) => {
    console.warn(`Video playback blocked: ${context}`, error)
  })
}

function seekVideoToPreviewFrame(video: HTMLVideoElement): void {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    video.currentTime = 0.1
    return
  }
  const onLoaded = (): void => {
    video.removeEventListener('loadeddata', onLoaded)
    video.currentTime = 0.1
  }
  video.addEventListener('loadeddata', onLoaded)
}

/**
 * Lead image or video for story cards and article pages.
 * Teaser: muted looping clip for homepage hero. Full: paused muted player with controls.
 */
export function ArticleLeadMedia({
  article,
  mode = 'teaser',
  teaserOverlay = false,
  autoPlayUnmuted = false,
  playbackNonce = 0,
  className,
  imageSizes,
  priority = false,
}: IArticleLeadMediaProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoSrc = articleVideoSrc(article)
  const poster = articleImageSrc(article)
  const posterIsDataUri = isDataUri(poster)
  const useTeaserOverlay = mode === 'teaser' && teaserOverlay && Boolean(videoSrc)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoSrc || mode !== 'teaser') {
      return
    }

    video.muted = true
    video.load()

    const loopTeaserClip = (): void => {
      if (video.currentTime >= ARTICLE_TEASER_CLIP_SECONDS) {
        video.currentTime = 0
        playVideoSafely(video, 'teaser-loop')
      }
    }

    const restoreMutedTeaser = (event: PageTransitionEvent): void => {
      if (!event.persisted || !videoRef.current) {
        return
      }
      videoRef.current.muted = true
      playVideoSafely(videoRef.current, 'teaser-pageshow')
    }

    video.addEventListener('timeupdate', loopTeaserClip)
    window.addEventListener('pageshow', restoreMutedTeaser)
    playVideoSafely(video, 'teaser-initial')

    return () => {
      video.removeEventListener('timeupdate', loopTeaserClip)
      window.removeEventListener('pageshow', restoreMutedTeaser)
      video.pause()
      video.muted = true
    }
  }, [article.id, mode, videoSrc])

  useLayoutEffect(() => {
    const video = videoRef.current
    if (!video || !videoSrc || mode !== 'full') {
      return
    }

    const unmuteOnPlay = (): void => {
      video.muted = false
    }

    video.addEventListener('play', unmuteOnPlay)

    if (autoPlayUnmuted) {
      video.muted = false
      const playPromise = video.play()
      if (playPromise !== undefined) {
        void playPromise.catch((error: unknown) => {
          console.warn('Full video unmuted play blocked; falling back to muted playback', error)
          video.muted = true
          playVideoSafely(video, 'full-muted-fallback')
        })
      }
    } else {
      video.pause()
      video.muted = true
    }

    return () => {
      video.removeEventListener('play', unmuteOnPlay)
      video.pause()
      video.muted = true
    }
  }, [article.id, autoPlayUnmuted, mode, playbackNonce, videoSrc])

  if (useTeaserOverlay) {
    return (
      <>
        <Image
          src={poster}
          alt=""
          fill
          className="object-cover"
          unoptimized={posterIsDataUri}
          sizes={imageSizes}
          priority={priority}
          aria-hidden
        />
        <div className="absolute inset-0 z-[1] flex items-center justify-center p-[10%]">
          <video
            ref={videoRef}
            src={videoSrc ?? undefined}
            className="pointer-events-none aspect-video h-auto max-h-full w-full max-w-[78%] object-cover shadow-lg ring-1 ring-black/15"
            autoPlay
            muted
            loop
            playsInline
            disablePictureInPicture
            tabIndex={-1}
            preload="auto"
            aria-hidden
          />
        </div>
      </>
    )
  }

  if (videoSrc && mode === 'preview-frame') {
    return (
      <video
        src={`${videoSrc}#t=0.1`}
        muted
        playsInline
        preload="auto"
        className={className ?? 'absolute inset-0 h-full w-full object-cover'}
        aria-hidden
        tabIndex={-1}
        onLoadedData={(event) => seekVideoToPreviewFrame(event.currentTarget)}
      />
    )
  }

  if (videoSrc && mode === 'teaser') {
    return (
      <video
        ref={videoRef}
        src={videoSrc}
        className={[
          className ?? 'absolute inset-0 h-full w-full object-cover',
          'pointer-events-none',
        ].join(' ')}
        autoPlay
        muted
        loop
        playsInline
        disablePictureInPicture
        tabIndex={-1}
        preload="auto"
        aria-hidden
      />
    )
  }

  if (videoSrc && mode === 'full') {
    return (
      <video
        ref={videoRef}
        key={`${article.id}:${videoSrc}`}
        src={videoSrc}
        className={className ?? 'absolute inset-0 h-full w-full object-cover'}
        muted={!autoPlayUnmuted}
        controls
        playsInline
        preload="metadata"
        aria-label={article.title}
      />
    )
  }

  return (
    <Image
      src={poster}
      alt={article.title}
      fill
      className={className ?? 'object-cover'}
      unoptimized={posterIsDataUri}
      sizes={imageSizes}
      priority={priority}
    />
  )
}

/**
 * Check whether an article has a usable lead-video URL.
 *
 * @param article Article subset with optional video URL.
 * @returns True when a valid video URL exists.
 */
export function ArticleLeadMediaHasVideo(
  article: Pick<IArticle, 'videoUrl'>,
): boolean {
  return articleVideoSrc(article) !== null
}
