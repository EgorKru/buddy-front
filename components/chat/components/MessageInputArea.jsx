import { useMemo } from 'react';
import { useAudioPreviewDuration } from '../hooks/useAudioPreviewDuration';
import { EditReplyBar } from './messageInput/EditReplyBar';
import { FilePreviewBar } from './messageInput/FilePreviewBar';
import { RecordingControls } from './messageInput/RecordingControls';
import { TextInputRow, SendButton } from './messageInput/TextInputRow';
import styles from '@/styles/chat.module.css';

export default function MessageInputArea({
  newMessage,
  editingMessageId,
  editingContent,
  replyingToMessage,
  selectedFile,
  selectedFileUrlRef,
  isRecording,
  isLocked,
  isHolding,
  dragDistance,
  reachedLockThreshold,
  lockThreshold,
  isPaused,
  isPlayingPreview,
  sending,
  uploadingFile,
  messageInputRef,
  fileInputRef,
  buttonRef,
  audioPreviewRef,
  onMessageChange,
  onEditingContentChange,
  onSendMessage,
  onSaveEdit,
  onCancelEdit,
  onCancelReply,
  onFileSelect,
  onRemoveFile,
  onMouseDown,
  onTouchStart,
  onKeyDown,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  onCancelRecording,
  onPlayPreview,
  recordingTime,
}) {
  const { currentTime, setCurrentTime, duration } = useAudioPreviewDuration(
    audioPreviewRef,
    isRecording,
    isLocked,
    recordingTime
  );

  const previewBlobUrl = useMemo(() => {
    if (audioPreviewRef?.current && isRecording && isLocked && (isPaused || isPlayingPreview)) {
      const audio = audioPreviewRef.current;
      if (audio.src && audio.src.startsWith('blob:')) {
        return audio.src;
      }
    }
    return '';
  }, [audioPreviewRef, isRecording, isLocked, isPaused, isPlayingPreview]);

  const showTextRow = !isRecording;

  return (
    <form onSubmit={editingMessageId ? onSaveEdit : onSendMessage} className={styles.messageForm}>
      <EditReplyBar
        editingMessageId={editingMessageId}
        replyingToMessage={replyingToMessage}
        onCancelEdit={onCancelEdit}
        onCancelReply={onCancelReply}
      />

      <FilePreviewBar
        selectedFile={selectedFile}
        selectedFileUrlRef={selectedFileUrlRef}
        onRemoveFile={onRemoveFile}
      />

      <div className={styles.messageFormRow}>
        {isRecording && (
          <RecordingControls
            isRecording={isRecording}
            isLocked={isLocked}
            isHolding={isHolding}
            recordingTime={recordingTime}
            isPaused={isPaused}
            isPlayingPreview={isPlayingPreview}
            duration={duration}
            currentTime={currentTime}
            previewBlobUrl={previewBlobUrl}
            audioPreviewRef={audioPreviewRef}
            setCurrentTime={setCurrentTime}
            onPauseRecording={onPauseRecording}
            onResumeRecording={onResumeRecording}
            onCancelRecording={onCancelRecording}
            onStopRecording={onStopRecording}
            onPlayPreview={onPlayPreview}
          />
        )}

        {showTextRow && (
          <>
            <TextInputRow
              newMessage={newMessage}
              editingMessageId={editingMessageId}
              editingContent={editingContent}
              messageInputRef={messageInputRef}
              fileInputRef={fileInputRef}
              buttonRef={buttonRef}
              sending={sending}
              uploadingFile={uploadingFile}
              isRecording={isRecording}
              isLocked={isLocked}
              isHolding={isHolding}
              dragDistance={dragDistance}
              reachedLockThreshold={reachedLockThreshold}
              lockThreshold={lockThreshold}
              onMessageChange={onMessageChange}
              onEditingContentChange={onEditingContentChange}
              onKeyDown={onKeyDown}
              onFileSelect={onFileSelect}
              onMouseDown={onMouseDown}
              onTouchStart={onTouchStart}
            />
            <SendButton
              editingMessageId={editingMessageId}
              hasContent={!!newMessage.trim()}
              selectedFile={selectedFile}
              isRecording={isRecording}
              sending={sending}
              uploadingFile={uploadingFile}
            />
          </>
        )}
      </div>

      {isRecording && isLocked && audioPreviewRef && (
        <audio
          ref={audioPreviewRef}
          preload="metadata"
          onTimeUpdate={() => {
            if (audioPreviewRef.current) {
              setCurrentTime(audioPreviewRef.current.currentTime || 0);
            }
          }}
          onPlay={() => {
            if (audioPreviewRef.current) {
              setCurrentTime(audioPreviewRef.current.currentTime || 0);
            }
          }}
          onEnded={() => {
            if (audioPreviewRef.current) {
              audioPreviewRef.current.pause();
              audioPreviewRef.current.currentTime = 0;
            }
            setCurrentTime(0);
            onPlayPreview(false);
          }}
          onError={() => {
            setCurrentTime(0);
            onPlayPreview(false);
          }}
          style={{ display: 'none' }}
        />
      )}
    </form>
  );
}
