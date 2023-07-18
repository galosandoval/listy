import { MyHead } from 'components/Head'
import ChatWindow from 'components/ChatWindow'
import { SubmitMessageForm } from 'components/SubmitMessageForm'
import { useChat } from 'hooks/chatHooks'

export default function ChatView() {
  const {
    input,
    isSendingMessage,

    handleInputChange,
    handleSubmit,
    ...rest
  } = useChat()

  return (
    <>
      <MyHead title='Listy - Chat' />
      <div className='relative flex h-full flex-1 flex-col items-stretch overflow-auto'>
        <div className='flex-1 overflow-hidden'>
          <ChatWindow isSendingMessage={isSendingMessage} {...rest} />
        </div>
        <SubmitMessageForm
          input={input}
          isSendingMessage={isSendingMessage}
          handleSubmit={handleSubmit}
          handleInputChange={handleInputChange}
        />
      </div>
    </>
  )
}
