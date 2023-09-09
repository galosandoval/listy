import { Chat, Message } from '@prisma/client'
import { useChat as useAiChat, Message as AiMessage } from 'ai/react'
import { useRecipeFilters } from 'components/RecipeFilters'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import {
  FormEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState
} from 'react'
import { toast } from 'react-hot-toast'
import { api } from 'utils/api'
import { z } from 'zod'

export type FormValues = {
  name: string
  ingredients: string
  instructions: string
  description: string
  prepTime: string
  cookTime: string
  notes: string
}

export type ChatType = ReturnType<typeof useChat>
export const useChat = () => {
  const [state, dispatch] = useChatReducer({
    chatId: undefined
  })
  const router = useRouter()
  const { status: authStatus, data } = useSession()

  const isAuthenticated = authStatus === 'authenticated'
  const userId = data?.user.id
  const utils = api.useContext()

  const {
    messages,
    input,
    setInput,
    handleInputChange,
    stop,
    handleSubmit: submitMessages,
    isLoading: isSendingMessage,
    setMessages
  } = useAiChat({
    onFinish: (messages) => onFinishMessage(messages)
  })

  const { mutate: addMessages } = api.chat.addMessages.useMutation({
    onSuccess(data) {
      // }
      setMessages(data)
    }
  })

  const { mutate: create } = api.chat.create.useMutation({
    onSuccess(data) {
      dispatch({ type: 'chatIdChanged', payload: data.id })
      const messages = data.messages.map((m) => ({
        content: m.content,
        id: m.id,
        role: m.role,
        recipeId: m.recipeId
      }))

      setMessages(messages)
      utils.chat.getMessagesByChatId.invalidate({ chatId: data.id })
    }
  })

  function onFinishMessage(message: AiMessage) {
    if (isAuthenticated) {
      if (!!state.chatId) {
        addMessages({
          messages: [{ content: input, role: 'user' }, message as Message],
          chatId: state.chatId
        })
      } else {
        create({
          messages: [{ content: input, role: 'user' }, message as Message]
        })
      }
    }
  }

  const [shouldFetchChat, setShouldFetchChat] = useState(true)

  const enabled = isAuthenticated && !!state.chatId && shouldFetchChat

  const { status, fetchStatus } = api.chat.getMessagesByChatId.useQuery(
    { chatId: state.chatId || '' },
    {
      enabled,
      onSuccess: (data) => {
        if (data) {
          setMessages(data.messages)
        }
      },
      keepPreviousData: true
    }
  )

  const [isChatsModalOpen, setIsChatsModalOpen] = useState(false)

  const handleGetChatsOnSuccess = useCallback(
    (
      data: (Chat & {
        messages: Message[]
      })[]
    ) => {
      if (
        typeof sessionStorage.getItem('currentChatId') !== 'string' &&
        data[0]?.id
      ) {
        dispatch({ type: 'chatIdChanged', payload: data[0].id })
      }
    },
    []
  )

  const handleChangeChat = useCallback(
    (
      chat: Chat & {
        messages: Message[]
      }
    ) => {
      dispatch({ type: 'chatIdChanged', payload: chat.id })
      setShouldFetchChat(true)
      handleToggleChatsModal()
    },
    []
  )

  const handleFillMessage = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    setInput(e.currentTarget.innerText.toLowerCase())
  }, [])

  const handleStartNewChat = useCallback(() => {
    stop()
    setMessages([])
    dispatch({ type: 'chatIdChanged', payload: '' })
  }, [])

  const handleToggleChatsModal = useCallback(() => {
    setIsChatsModalOpen((state) => !state)
  }, [])

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      setShouldFetchChat(false)
      if (isSendingMessage) {
        stop()
      } else {
        submitMessages(event)
      }
    },
    [isSendingMessage, stop, submitMessages]
  )

  const recipeFilters = useRecipeFilters()

  useEffect(() => {
    if (userId) {
      utils.chat.getChats.prefetch({ userId })
      router.push('/chat')
    }
  }, [userId])

  useEffect(() => {
    if (
      typeof window !== undefined &&
      typeof sessionStorage?.getItem('currentChatId') === 'string'
    ) {
      const currentChatId = sessionStorage.getItem('currentChatId')

      dispatch({
        type: 'chatIdChanged',
        payload:
          currentChatId !== undefined
            ? JSON.parse(currentChatId as string)
            : undefined
      })
    }
  }, [])

  const {
    handleGoToRecipe,
    handleSaveRecipe,
    status: saveRecipeStatus
  } = useSaveRecipe(messages, setMessages)

  return {
    recipeFilters,
    chatId: state.chatId,
    fetchStatus,
    status,
    isChatsModalOpen,
    input,
    messages,
    isSendingMessage,
    isAuthenticated,
    saveRecipeStatus,

    handleGoToRecipe,
    handleSaveRecipe,

    handleGetChatsOnSuccess,
    handleInputChange: useCallback(handleInputChange, []),
    handleToggleChatsModal,
    handleChangeChat,
    handleStartNewChat,
    handleFillMessage,
    handleSubmit
  }
}

type ChatState = {
  chatId?: string
}

function useChatReducer(initialState: ChatState) {
  const [state, dispatch] = useReducer(
    (state: ChatState, action: ChatAction) => {
      const { type, payload } = action
      switch (type) {
        case 'chatIdChanged':
          sessionStorage.setItem('currentChatId', JSON.stringify(payload))

          return {
            ...state,
            chatId: payload
          }

        default:
          return state
      }
    },
    initialState
  )

  return [state, dispatch] as const
}

type ChatAction =
  | {
      type: 'chatIdChanged'
      payload: string | undefined
    }
  | {
      type: 'reset'
      payload: undefined
    }

export const errorMessage = 'Please try rephrasing your question.'

const sendMessageFormSchema = z.object({ message: z.string().min(6) })
export type ChatRecipeParams = z.infer<typeof sendMessageFormSchema>

export type SaveRecipe = ReturnType<typeof useSaveRecipe>

export const useSaveRecipe = (
  messages: AiMessage[],
  setMessages: (messages: AiMessage[]) => void
) => {
  const utils = api.useContext()
  const {
    mutate: createRecipe,
    status,
    data
  } = api.recipe.create.useMutation({
    onSuccess: (newRecipe, { messageId }) => {
      utils.recipe.invalidate()
      const messagesCopy = [...messages]
      if (messageId) {
        const messageToChange = messagesCopy.find(
          (message) => message.id === messageId
        ) as Message
        if (messageToChange) {
          messageToChange.recipeId = newRecipe.id
        }
      }

      setMessages(messagesCopy)

      toast.success('Recipe saved successfully!')
    },
    onError: (error) => {
      toast.error('Error: ' + error.message)
    }
  })

  const router = useRouter()

  const memoizedData = useMemo(() => data, [data])

  const handleGoToRecipe = useCallback(
    ({
      recipeId,
      recipeName
    }: {
      recipeId: string | null
      recipeName?: string
    }) => {
      if (recipeId && recipeName) {
        router.push(
          `recipes/${recipeId}?name=${encodeURIComponent(recipeName)}`
        )
      }
    },
    []
  )

  const handleSaveRecipe = useCallback(
    ({ content, messageId }: { content: string; messageId?: string }) => {
      if (!content) return

      const {
        name,
        description,
        cookTime,
        prepTime,
        ingredients,
        instructions
      } = transformContentToRecipe(content)

      createRecipe({
        name,
        description,
        prepTime,
        cookTime,
        instructions: removeLeadingHyphens(instructions)
          .split('\n')
          .filter(Boolean),
        ingredients: ingredients
          .split('\n')
          .map((s) => removeLeadingHyphens(s))
          .filter(Boolean),
        messageId
      })
    },
    []
  )

  return {
    status,
    data: memoizedData,

    handleSaveRecipe,
    handleGoToRecipe
  }
}

function transformContentToRecipe(content: string) {
  let name = ''
  const nameIdx = content.toLowerCase().indexOf('name:')
  if (nameIdx !== -1) {
    const endIdx = content.indexOf('\n', nameIdx)
    if (endIdx !== -1) {
      name = content.slice(nameIdx + 6, endIdx)
    }
  }

  let description = ''
  const descriptionIdx = content.toLowerCase().indexOf('description:', nameIdx)
  if (descriptionIdx !== -1) {
    const endIdx = content.indexOf('\n', descriptionIdx)
    if (endIdx !== -1) {
      description = content.slice(descriptionIdx + 13, endIdx)
    }
  }

  let prepTime = ''
  const prepTimeIdx = content.toLowerCase().indexOf('preparation time:')
  if (prepTimeIdx !== -1) {
    const endIdx = content.indexOf('\n', prepTimeIdx)
    if (endIdx !== -1) {
      prepTime = content.slice(prepTimeIdx + 18, endIdx)
    }
  }

  let cookTime = ''
  const cookTimeIdx = content.toLowerCase().indexOf('cook time:')
  if (cookTimeIdx !== -1) {
    const endIdx = content.indexOf('\n', cookTimeIdx)
    if (endIdx !== -1) {
      cookTime = content.slice(cookTimeIdx + 11, endIdx)
    }
  }

  let instructions = ''
  const instructionsIdx = content.toLowerCase().indexOf('instructions:')
  if (instructionsIdx !== -1) {
    const endIdx = content.indexOf('\n\n', instructionsIdx)
    if (endIdx !== -1) {
      instructions = content.slice(instructionsIdx + 14, endIdx)
    }
  }

  let ingredients = ''
  const ingredientsIdx = content.toLowerCase().indexOf('ingredients:')
  if (ingredientsIdx !== -1) {
    if (instructionsIdx !== -1) {
      ingredients = content.slice(ingredientsIdx + 13, instructionsIdx - 2)
    }
  }

  return { name, description, prepTime, cookTime, instructions, ingredients }
}

function removeLeadingHyphens(str: string) {
  if (str && str[0] === '-') {
    return str.slice(2)
  }

  return str
}
