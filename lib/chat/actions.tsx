import 'server-only'
import sqlite3 from 'better-sqlite3';
import path from 'path';

import {createAI, createStreamableValue, getAIState, getMutableAIState, streamUI} from 'ai/rsc'
import {generateText} from "ai"
import {createAzure} from '@ai-sdk/azure'

import {BotMessage,} from '@/components/stocks'

import {nanoid} from '@/lib/utils'
import {saveChat} from '@/app/actions'
import {SpinnerMessage, UserMessage} from '@/components/stocks/message'
import {Chat, Message} from '@/lib/types'
import {auth} from '@/auth'

const azure = createAzure({
  apiKey: process.env.AZURE_API_KEY,
  baseURL: process.env.AZURE_ENDPOINT,
});


/**
 * Helper function to execute SQLite query
 * @param query The SQLite query to execute.
 */
function executeSQLiteQuery(query: string) {
  const dbPath = path.join(process.cwd(), 'public', 'db', 'triage.db');
  const db = sqlite3(dbPath);

  try {
    return db.prepare(query).all();
  } catch (error) {
    console.error('Error executing query:', error);
    return [];
  } finally {
    db.close();
  }
}

/**
 * Helper function to convert tabular data to a Markdown table.
 * @param data
 */
function formatDataAsMarkdownTable(data: any[]): string {
  if (data.length === 0) return '*No results found.*';

  const headers = Object.keys(data[0]); // Get column names
  const rows = data.map(row => Object.values(row)); // Get row values

  let markdownTable = `| ${headers.join(' | ')} |\n`; // Header row
  markdownTable += `| ${headers.map(() => '---').join(' | ')} |\n`; // Divider row
  rows.forEach(row => {
    markdownTable += `| ${row.join(' | ')} |\n`;
  });

  return markdownTable;
}

/**
 * Handles a submitted message by the user.
 * @param content The input of the user.
 */
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

  // Generate SQL queries using the database schemes
  const queryResult = await generateText({
    model: azure('text-to-sql'),
    system: `\
    You are a security triage assistant, and your only job is transforming the user's question regarding a windows client 
    to executable SQLite queries.
    You will always answer with 3 possible SQL queries and nothing more using the following database schemes.
    Only if you dont find a suitable schema that could contain the data you are allowed to answer "Request was not possible".
    
    Example:
    Q: Are there any users on this system, that are not password protected?
    
    => SELECT Username, SecurityID, fullname FROM useraccounts WHERE passwordrequired = 0;

    Schemes:
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

  // Select the best query out of a string of queries
  const result = await streamUI({
    model: azure('text-to-sql'),
    initial: <SpinnerMessage />,
    system: `\
    You are a query optimization assistant. From the following 3 SQLite queries, choose the best one and return it as your unformatted response.
    If you do not get any SQL queries return nothing.
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
        textNode = <SpinnerMessage />
      }

      if (done) {
        // Execute the selected query on the SQLite database
        const query: string = content.trim()
        const errorMessage: string = '*Sorry, no query could be generated*'

        let queryResults: any[] = []
        let formattedResults: string | null = null
        let markdownTable: string = ''

        if (query.length > 0) {
          try {
            queryResults = executeSQLiteQuery(query)
            if (queryResults.length > 0) {
              formattedResults = queryResults.length
                  ? JSON.stringify(queryResults, null, 2)
                  : 'No results found.'
              markdownTable = formatDataAsMarkdownTable(queryResults)
            } else {
              formattedResults = '*No results found.*'
            }
          } catch (error: any) {
            console.log(`Error executing query: ${error.message}`)
            formattedResults = null
          }
        }

        textNode = (
            <BotMessage content={formattedResults
                ? `Executing \`${query}\`\n\n${markdownTable}`
                : errorMessage} />
        );

        textStream.done();
        aiState.done({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: nanoid(),
              role: 'assistant',
              content: formattedResults
                  ? `\`${query}\`\n\n${formattedResults}`
                  : errorMessage,
            },
          ],
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
