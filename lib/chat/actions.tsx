import 'server-only'

import {
  createAI,
  getMutableAIState,
  getAIState,
  streamUI,
  createStreamableValue
} from 'ai/rsc'
import { generateText } from "ai"
import { createAzure } from '@ai-sdk/azure'

import {
  BotMessage,
} from '@/components/stocks'

import {
  nanoid
} from '@/lib/utils'
import { saveChat } from '@/app/actions'
import { SpinnerMessage, UserMessage } from '@/components/stocks/message'
import { Chat, Message } from '@/lib/types'
import { auth } from '@/auth'

const azure = createAzure({
  apiKey: process.env.AZURE_API_KEY,
  baseURL: process.env.AZURE_ENDPOINT,
});

async function submitUserMessage(content: string) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: 'user',
        content
      }
    ]
  })

  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
  let textNode: undefined | React.ReactNode

  const queryResult = await generateText({
    model: azure('text-to-sql'),
    system: `\
    You are a security triage assistant, and your only job is transforming the user's question regarding a windows client 
    to executable SQLite queries.
    You will always answer with 3 possible SQL queries and nothing more using the following database schemes.
    
    \\--System Data
    CREATE TABLE "system" (
      "Tag" REAL,
      "Notes" REAL,
      "Hostname" TEXT,
      "AgentID" TEXT,
      "FireEyeGeneratedTime" TEXT,
      "machine" TEXT,
      "totalphysical" INTEGER,
      "availphysical" INTEGER,
      "uptime" TEXT,
      "OS" TEXT,
      "OSbitness" TEXT,
      "hostname_duplicate1" TEXT,
      "date" TEXT,
      "user" TEXT,
      "domain" TEXT,
      "processor" TEXT,
      "patchLevel" REAL,
      "buildNumber" INTEGER,
      "procType" TEXT,
      "productID" TEXT,
      "productName" TEXT,
      "regOrg" REAL,
      "regOwner" TEXT,
      "installDate" TEXT,
      "MAC" TEXT,
      "timezoneDST" TEXT,
      "timezoneStandard" TEXT,
      "networkArray" REAL,
      "containmentState" TEXT,
      "timezone" TEXT,
      "gmtoffset" TEXT,
      "clockSkew" TEXT,
      "stateAgentStatus" TEXT,
      "primaryIpv4Address" TEXT,
      "primaryIpAddress" TEXT,
      "loggedOnUser" TEXT,
      "appVersion" TEXT,
      "platform" TEXT,
      "appCreated" TEXT,
      "biosInfo.biosDate" TEXT,
      "biosInfo.biosType" TEXT,
      "biosInfo.biosVersion" TEXT,
      "directory" TEXT,
      "drives" TEXT,
      "networkArray.networkInfo.adapter" TEXT,
      "networkArray.networkInfo.description" TEXT,
      "networkArray.networkInfo.dhcpLeaseExpires" TEXT,
      "networkArray.networkInfo.dhcpLeaseObtained" TEXT,
      "networkArray.networkInfo.dhcpServerArray.dhcpServer" TEXT,
      "networkArray.networkInfo.ipArray.ipInfo.ipAddress" TEXT,
      "networkArray.networkInfo.ipArray.ipInfo.ipv6Address" TEXT,
      "networkArray.networkInfo.ipArray.ipInfo.subnetMask" TEXT,
      "networkArray.networkInfo.ipGatewayArray.ipGateway" TEXT,
      "networkArray.networkInfo.MAC" TEXT
    );
    CREATE TABLE "useraccounts" (
    "Tag" REAL,
      "Notes" REAL,
      "Hostname" TEXT,
      "AgentID" TEXT,
      "FireEyeGeneratedTime" TEXT,
      "Username" TEXT,
      "SecurityID" TEXT,
      "SecurityType" TEXT,
      "fullname" TEXT,
      "description" TEXT,
      "homedirectory" REAL,
      "scriptpath" REAL,
      "grouplist" REAL,
      "LastLogin" TEXT,
      "disabled" INTEGER,
      "lockedout" INTEGER,
      "passwordrequired" INTEGER,
      "userpasswordage" TEXT,
      "shell" REAL,
      "userid" REAL,
      "userguid" REAL,
      "grouplist.groupname" TEXT
    );
    `,
    messages: [
      ...aiState.get().messages.map((message: any) => ({
        role: message.role,
        content: message.content,
        name: message.name
      }))
    ]
  })

  console.log('Generated Queries:', queryResult.text);

  const result = await streamUI({
    model: azure('text-to-sql'),
    initial: <SpinnerMessage />,
    system: `\
    You are a query optimization assistant. From the following 3 SQLite queries, choose the best one and return it as your unformatted response.
    \\
    `,
    messages: [
      {
        role: 'user',
        content: `${content} \\ ${queryResult.text}`,
      },
    ],
    text: ({ content, done, delta }) => {
      if (!textStream) {
        textStream = createStreamableValue('')
        textNode = <BotMessage content={textStream.value} />
      }

      if (done) {
        textStream.done()
        aiState.done({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: nanoid(),
              role: 'assistant',
              content
            }
          ]
        })
      } else {
        textStream.update(delta)
      }

      return textNode
    }
  })

  return {
    id: nanoid(),
    display: result.value
  }
}

export type AIState = {
  chatId: string
  messages: Message[]
}

export type UIState = {
  id: string
  display: React.ReactNode
}[]

export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage
  },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), messages: [] },
  onGetUIState: async () => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const aiState = getAIState() as Chat

      if (aiState) {
        // Return UI state
        return getUIStateFromAIState(aiState)
      }
    } else {
      return
    }
  },
  onSetAIState: async ({ state }) => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const { chatId, messages } = state

      const createdAt = new Date()
      const userId = session.user.id as string
      const path = `/chat/${chatId}`

      const firstMessageContent = messages[0].content as string
      const title = firstMessageContent.substring(0, 100)

      const chat: Chat = {
        id: chatId,
        title,
        userId,
        createdAt,
        messages,
        path
      }

      await saveChat(chat)
    } else {
      return
    }
  }
})

export const getUIStateFromAIState = (aiState: Chat) => {
  return aiState.messages
    .filter(message => message.role !== 'system')
    .map((message, index) => ({
      id: `${aiState.chatId}-${index}`,
      display:
        message.role === 'user' ? (
          <UserMessage>{message.content as string}</UserMessage>
        ) : message.role === 'assistant' &&
          typeof message.content === 'string' ? (
          <BotMessage content={message.content} />
        ) : null
    }))
}
