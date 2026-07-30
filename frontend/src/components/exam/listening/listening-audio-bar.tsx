"use client";

import { useEffect } from "react";
import { AlertTriangle, Play, Volume2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDuration } from "../exam-utils";
import type { ExamSession } from "../hooks/use-exam-session";

type ListeningAudioBarProps = {
  session: ExamSession;
};

export function ListeningAudioBar({ session }: ListeningAudioBarProps) {
  const {
    audioRef,
    currentListeningTrack,
    listeningTracks,
    listeningTrackIndex,
    audioPositionSeconds,
    audioDurationSeconds,
    setAudioDurationSeconds,
    setAudioPositionSeconds,
    audioStarted,
    audioCompleted,
    listeningFinalCountdownEndsAt,
    postAudioSecondsLeft,
    onListeningAudioEnded,
    startAudio,
    onAudioPlaybackFailed
  } = session;

  useEffect(() => {
    if (!currentListeningTrack?.asset?.signedUrl) return;
    const element = audioRef.current;
    if (!element || !audioStarted || audioCompleted || element.ended) return;
    if (!element.paused) return;

    void element.play().catch(() => {
      onAudioPlaybackFailed();
    });
  }, [
    audioCompleted,
    audioRef,
    audioStarted,
    currentListeningTrack?.asset?.signedUrl,
    currentListeningTrack?.id,
    listeningTrackIndex,
    onAudioPlaybackFailed
  ]);

  if (!currentListeningTrack?.asset?.signedUrl) return null;

  const isPlaying = audioStarted && !audioCompleted;

  return (
    <div className="exam-audio-bar listening-exam-audio-bar">
      <audio
        key={`${listeningTrackIndex}-${currentListeningTrack.id}`}
        ref={audioRef}
        src={currentListeningTrack.asset.signedUrl}
        preload="auto"
        onLoadedMetadata={(event) => setAudioDurationSeconds(Math.floor(event.currentTarget.duration || 0))}
        onTimeUpdate={(event) => setAudioPositionSeconds(Math.floor(event.currentTarget.currentTime))}
        onError={() => {
          onAudioPlaybackFailed();
        }}
        onPause={(event) => {
          if (!audioCompleted && audioStarted && !event.currentTarget.ended) {
            void event.currentTarget.play().catch(() => {
              onAudioPlaybackFailed();
            });
          }
        }}
        onSeeking={(event) => {
          event.currentTarget.currentTime = audioPositionSeconds;
        }}
        onEnded={() => {
          void onListeningAudioEnded();
        }}
        className="hidden"
      />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          size="sm"
          className="h-10 shrink-0 gap-2 rounded-full px-5"
          disabled={audioCompleted}
          onClick={() => void startAudio()}
        >
          {isPlaying ? <Volume2 className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          {isPlaying ? "Playing audio" : audioCompleted ? "Audio finished" : "Play audio"}
        </Button>

        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:flex-1">
          Plays once only · no pause or rewind
        </p>

        <p className="shrink-0 text-right text-sm tabular-nums text-muted-foreground">
          {formatDuration(audioPositionSeconds)} / {audioDurationSeconds > 0 ? formatDuration(audioDurationSeconds) : "--:--"}
        </p>
      </div>

      {listeningTracks.length > 1 ? (
        <p className="mx-auto mt-2 w-full max-w-4xl text-center text-xs text-muted-foreground">
          Extract {listeningTrackIndex + 1} of {listeningTracks.length}
          {currentListeningTrack.label ? ` · ${currentListeningTrack.label}` : ""}
        </p>
      ) : null}

      {postAudioSecondsLeft !== null && postAudioSecondsLeft >= 0 ? (
        <Alert className="mx-auto mt-3 max-w-4xl border-amber-300/60 bg-amber-50/50 dark:border-amber-700/50 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Final {postAudioSecondsLeft}s</AlertTitle>
          <AlertDescription>Your listening attempt will auto-submit when the countdown ends.</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
