import 'server-only'

import {createAI, createStreamableValue, getAIState, getMutableAIState, streamUI} from 'ai/rsc'
import {generateText} from "ai"
import {createAzure} from '@ai-sdk/azure'

import {BotMessage,} from '@/components/stocks'

import {nanoid, executeSQLiteQuery, formatDataAsMarkdownTable} from '@/lib/utils'
import {saveChat} from '@/app/actions'
import {SpinnerMessage, UserMessage} from '@/components/stocks/message'
import {Chat, Message} from '@/lib/types'
import {auth} from '@/auth'
import React from "react";

const azure = createAzure({
  apiKey: process.env.AZURE_API_KEY,
  baseURL: process.env.AZURE_ENDPOINT,
});

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
    You are a digital forensic assistant, and your only job is transforming the user's question regarding a windows client 
    to executable SQLite queries to query system logs.
    You will always answer with: 
    - repeating the user Question,
    - 3 possible SQL queries to get the necessary information, and
    - the corresponding table schema used. 
    Base your queries on the database schemes below.
    Only if you can't find a suitable schema that could contain the data you are allowed to answer "Request was not possible".
    
    Example Queries:
    Q: Are there any users on this system, that are not password protected?
    A: SELECT Username, SecurityID, fullname FROM useraccounts WHERE passwordrequired = 0;
    
    Q: Show all registry changes in the last 24 hours since the containment of the data.
    A: SELECT Path, Text, Modified Username FROM registryapi WHERE Modified >= datetime(’FireEyeGeneratedTime’, ’-1 day’);

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
    
    --Process Data
    CREATE TABLE "processes_API" (
      "Tag" REAL,
      "Notes" REAL,
      "Hostname" TEXT,
      "AgentID" TEXT,
      "FireEyeGeneratedTime" TEXT,
      "pid" INTEGER,
      "parentpid" INTEGER,
      "path" TEXT,
      "name" TEXT,
      "arguments" TEXT,
      "Username" TEXT,
      "SecurityID" TEXT,
      "SecurityType" TEXT,
      "startTime" TEXT,
      "kernelTime" TEXT,
      "userTime" TEXT
    );
    CREATE TABLE "processes_handle" (
      "Tag" REAL,
      "Notes" REAL,
      "Hostname" TEXT,
      "AgentID" TEXT,
      "FireEyeGeneratedTime" TEXT,
      "pid" INTEGER,
      "parentpid" INTEGER,
      "path" TEXT,
      "name" TEXT,
      "arguments" TEXT,
      "Username" TEXT,
      "SecurityID" TEXT,
      "SecurityType" TEXT,
      "startTime" TEXT,
      "kernelTime" TEXT,
      "userTime" TEXT
    );
    CREATE TABLE "service" (
    "Tag" REAL,
      "Notes" REAL,
      "Hostname" TEXT,
      "AgentID" TEXT,
      "FireEyeGeneratedTime" TEXT,
      "name" TEXT,
      "descriptiveName" TEXT,
      "description" TEXT,
      "mode" TEXT,
      "startedAs" TEXT,
      "path" TEXT,
      "arguments" TEXT,
      "pathmd5sum" TEXT,
      "pathSignatureExists" INTEGER,
      "pathSignatureVerified" INTEGER,
      "pathSignatureDescription" TEXT,
      "pathCertificateSubject" TEXT,
      "pathCertificateIssuer" TEXT,
      "serviceDLL" TEXT,
      "serviceDLLmd5sum" TEXT,
      "serviceDLLSignatureExists" INTEGER,
      "serviceDLLSignatureVerified" INTEGER,
      "serviceDLLSignatureDescription" TEXT,
      "serviceDLLCertificateSubject" TEXT,
      "serviceDLLCertificateIssuer" TEXT,
      "status" TEXT,
      "pid" INTEGER,
      "type" TEXT,
      "md5sum" REAL,
      "sha1sum" REAL,
      "sha256sum" REAL,
      "userName" REAL,
      "groupName" REAL,
      "reference" REAL,
      "pathCertificateChain" TEXT
    );
    
    --Browser Data
    CREATE TABLE "cookiehistory" (
      "Tag" REAL,
      "Notes" REAL,
      "Hostname" TEXT,
      "AgentID" TEXT,
      "FireEyeGeneratedTime" TEXT,
      "FileName" REAL,
      "FilePath" REAL,
      "CookiePath" TEXT,
      "CookieName" TEXT,
      "CookieValue" TEXT,
      "HostName_duplicate1" TEXT,
      "ExpirationDate" TEXT,
      "CreationDate" REAL,
      "LastAccessedDate" TEXT,
      "LastModifiedDate" REAL,
      "Username" TEXT,
      "Profile" TEXT,
      "BrowserName" TEXT,
      "BrowserVersion" TEXT,
      "IsSecure" INTEGER,
      "IsHttpOnly" INTEGER
    );
    CREATE TABLE "formhistory" (
      "Tag" REAL,
      "Notes" REAL,
      "Hostname" TEXT,
      "AgentID" TEXT,
      "FireEyeGeneratedTime" TEXT,
      "Username" TEXT,
      "Profile" TEXT,
      "BrowserName" TEXT,
      "BrowserVersion" TEXT,
      "FormType" TEXT,
      "FormFieldName" TEXT,
      "FormFieldValue" TEXT,
      "TimesUsed" INTEGER,
      "FirstUsedDate" TEXT,
      "LastUsedDate" TEXT,
      "Guid" REAL
    );
    CREATE TABLE "urlhistory" (
      "Tag" REAL,
      "Notes" REAL,
      "Hostname" TEXT,
      "AgentID" TEXT,
      "FireEyeGeneratedTime" TEXT,
      "Profile" TEXT,
      "BrowserName" TEXT,
      "BrowserVersion" TEXT,
      "LastVisitDate" TEXT,
      "Username" TEXT,
      "URL" TEXT,
      "PageTitle" TEXT,
      "HostName_duplicate1" TEXT,
      "Typed" INTEGER,
      "Hidden" INTEGER,
      "VisitFrom" TEXT,
      "VisitType" TEXT,
      "VisitCount" REAL
    );
    
    --FileSystem Data
    CREATE TABLE "volumes" (
    "Tag" REAL,
      "Notes" REAL,
      "Hostname" TEXT,
      "AgentID" TEXT,
      "FireEyeGeneratedTime" TEXT,
      "VolumeName" TEXT,
      "DevicePath" TEXT,
      "DriveLetter" TEXT,
      "Type" TEXT,
      "Name" REAL,
      "SerialNumber" INTEGER,
      "FileSystemFlags" TEXT,
      "FileSystemName" TEXT,
      "ActualAvailableAllocationUnits" INTEGER,
      "TotalAllocationUnits" INTEGER,
      "BytesPerSector" INTEGER,
      "SectorsPerAllocationUnit" INTEGER,
      "CreationTime" TEXT,
      "IsMounted" INTEGER
    );
    CREATE TABLE "disks" (
      "Tag" REAL,
      "Notes" REAL,
      "Hostname" TEXT,
      "AgentID" TEXT,
      "FireEyeGeneratedTime" TEXT,
      "DiskName" TEXT,
      "DiskSize" REAL,
      "PartitionList.Partition.PartitionNumber" TEXT,
      "PartitionList.Partition.PartitionOffset" TEXT,
      "PartitionList.Partition.PartitionLength" TEXT,
      "PartitionList.Partition.PartitionType" TEXT
    );
    CREATE TABLE "apifiles" (
      "Tag" REAL,
      "Notes" REAL,
      "Hostname" TEXT,
      "AgentID" TEXT,
      "FireEyeGeneratedTime" TEXT,
      "FullPath" TEXT,
      "Created" TEXT,
      "Modified" TEXT,
      "Accessed" TEXT,
      "Changed" TEXT,
      "FilenameCreated" REAL,
      "FilenameModified" REAL,
      "FilenameAccessed" REAL,
      "FilenameChanged" REAL,
      "SizeInBytes" INTEGER,
      "Md5sum" TEXT,
      "Username" TEXT,
      "FileAttributes" TEXT,
      "INode" REAL,
      "SecurityID" TEXT,
      "SecurityType" TEXT,
      "DevicePath" TEXT,
      "Drive" TEXT,
      "FilePath" TEXT,
      "FileName" TEXT,
      "FileExtension" TEXT,
      "PeakCodeEntropy" REAL,
      "PeakEntropy" REAL,
      "PEInfo.BaseAddress" REAL,
      "PEInfo.DetectedAnomalies.string" TEXT,
      "PEInfo.DigitalSignature.CertificateChain" TEXT,
      "PEInfo.DigitalSignature.CertificateIssuer" TEXT,
      "PEInfo.DigitalSignature.CertificateSubject" TEXT,
      "PEInfo.DigitalSignature.Description" TEXT,
      "PEInfo.DigitalSignature.SignatureExists" INTEGER,
      "PEInfo.DigitalSignature.SignatureVerified" INTEGER,
      "PEInfo.EpJumpCodes" REAL,
      "PEInfo.EpJumpCodes.Depth" REAL,
      "PEInfo.EpJumpCodes.Opcodes" TEXT,
      "PEInfo.Exports.DllName" TEXT,
      "PEInfo.Exports.ExportedFunctions.string" TEXT,
      "PEInfo.Exports.ExportsTimeStamp" TEXT,
      "PEInfo.Exports.NumberOfFunctions" REAL,
      "PEInfo.Exports.NumberOfNames" REAL,
      "PEInfo.ExtraneousBytes" REAL,
      "PEInfo.ImportedModules" REAL,
      "PEInfo.ImportedModules.Module.ImportedFunctions.string" TEXT,
      "PEInfo.ImportedModules.Module.Name" TEXT,
      "PEInfo.ImportedModules.Module.NumberOfFunctions" TEXT,
      "PEInfo.PEChecksum.PEComputedAPI" REAL,
      "PEInfo.PEChecksum.PEFileAPI" REAL,
      "PEInfo.PEChecksum.PEFileRaw" REAL,
      "PEInfo.PETimeStamp" TEXT,
      "PEInfo.ResourceInfoList.ResourceInfoItem.Language" TEXT,
      "PEInfo.ResourceInfoList.ResourceInfoItem.Name" TEXT,
      "PEInfo.ResourceInfoList.ResourceInfoItem.Size" TEXT,
      "PEInfo.ResourceInfoList.ResourceInfoItem.Type" TEXT,
      "PEInfo.Sections.ActualNumberOfSections" REAL,
      "PEInfo.Sections.NumberOfSections" REAL,
      "PEInfo.Sections.Section.DetectedCharacteristics" TEXT,
      "PEInfo.Sections.Section.Entropy" TEXT,
      "PEInfo.Sections.Section.Name" TEXT,
      "PEInfo.Sections.Section.SizeInBytes" TEXT,
      "PEInfo.Sections.Section.Type" TEXT,
      "PEInfo.Subsystem" TEXT,
      "PEInfo.Type" TEXT,
      "PEInfo.VersionInfoList.VersionInfoItem.Comments" TEXT,
      "PEInfo.VersionInfoList.VersionInfoItem.CompanyName" TEXT,
      "PEInfo.VersionInfoList.VersionInfoItem.FileDescription" TEXT,
      "PEInfo.VersionInfoList.VersionInfoItem.FileVersion" TEXT,
      "PEInfo.VersionInfoList.VersionInfoItem.InternalName" TEXT,
      "PEInfo.VersionInfoList.VersionInfoItem.Language" TEXT,
      "PEInfo.VersionInfoList.VersionInfoItem.LegalCopyright" TEXT,
      "PEInfo.VersionInfoList.VersionInfoItem.LegalTrademarks" TEXT,
      "PEInfo.VersionInfoList.VersionInfoItem.OriginalFilename" TEXT,
      "PEInfo.VersionInfoList.VersionInfoItem.PrivateBuild" TEXT,
      "PEInfo.VersionInfoList.VersionInfoItem.ProductName" TEXT,
      "PEInfo.VersionInfoList.VersionInfoItem.ProductVersion" TEXT,
      "PEInfo.VersionInfoList.VersionInfoItem.SpecialBuild" TEXT,
      "StreamList.Stream.Md5sum" TEXT,
      "StreamList.Stream.Name" TEXT,
      "StreamList.Stream.SizeInBytes" REAL
    );
    CREATE TABLE "prefetch" (
      "Tag" REAL,
      "Notes" REAL,
      "Hostname" TEXT,
      "AgentID" TEXT,
      "FireEyeGeneratedTime" TEXT,
      "ApplicationFileName" TEXT,
      "ApplicationFullPath" TEXT,
      "Created" TEXT,
      "LastRun" TEXT,
      "TimesExecuted" INTEGER,
      "ReportedSizeInBytes" INTEGER,
      "FullPath" TEXT,
      "SizeInBytes" INTEGER,
      "PrefetchHash" TEXT,
      "AccessedFileList.AccessedFile" TEXT,
      "VolumeList.VolumeItem.CreationTime" TEXT,
      "VolumeList.VolumeItem.DevicePath" TEXT,
      "VolumeList.VolumeItem.SerialNumber" TEXT
    );
    
    --Network Data
    CREATE TABLE "network_arp" (
      "Tag" REAL,
      "Notes" REAL,
      "Hostname" TEXT,
      "AgentID" TEXT,
      "FireEyeGeneratedTime" TEXT,
      "Interface" TEXT,
      "InterfaceType" TEXT,
      "PhysicalAddress" TEXT,
      "IPv4Address" TEXT,
      "IPv6Address" TEXT,
      "IsRouter" INTEGER,
      "LastReachable" TEXT,
      "LastUnreachable" TEXT,
      "CacheType" TEXT,
      "State" TEXT
    );
    CREATE TABLE "network_route" (
      "Tag" REAL,
      "Notes" REAL,
      "Hostname" TEXT,
      "AgentID" TEXT,
      "FireEyeGeneratedTime" TEXT,
      "Interface" TEXT,
      "Destination" TEXT,
      "Netmask" TEXT,
      "Gateway" TEXT,
      "RouteType" TEXT,
      "Protocol" TEXT,
      "RouteAge" TEXT,
      "Metric" INTEGER,
      "IsIPv6" INTEGER,
      "IsAutoconfigureAddress" INTEGER,
      "IsImmortal" INTEGER,
      "IsLoopback" INTEGER,
      "IsPublish" INTEGER,
      "Origin" TEXT,
      "PreferredLifetime" TEXT,
      "ValidLifetime" TEXT
    );
    CREATE TABLE "ports" (
      "Tag" REAL,
      "Notes" REAL,
      "Hostname" TEXT,
      "AgentID" TEXT,
      "FireEyeGeneratedTime" TEXT,
      "pid" INTEGER,
      "process" TEXT,
      "path" TEXT,
      "state" TEXT,
      "localIP" TEXT,
      "remoteIP" TEXT,
      "localPort" INTEGER,
      "remotePort" INTEGER,
      "protocol" TEXT
    );
    
    --Persistence Data
    CREATE TABLE "hivelist" (
      "Tag" REAL,
      "Notes" REAL,
      "Hostname" TEXT,
      "AgentID" TEXT,
      "FireEyeGeneratedTime" TEXT,
      "Name" TEXT,
      "Path" TEXT
    );
    CREATE TABLE registryapi
    (
        Tag                   REAL,
        Notes                 REAL,
        Hostname              TEXT,
        AgentID               TEXT,
        FireEyeGeneratedTime  TEXT,
        Path                  TEXT,
        Text                  TEXT,
        Modified              TEXT,
        Username              TEXT,
        SecurityID            TEXT,
        Hive                  TEXT,
        KeyPath               TEXT,
        ValueName             TEXT,
        Type                  TEXT,
        Value                 TEXT,
        NumValues             REAL,
        NumSubKeys            REAL,
        ReportedLengthInBytes REAL,
        detectedAnomaly       TEXT
    );
    CREATE TABLE "tasks" (
    "Tag" REAL,
      "Notes" REAL,
      "Hostname" TEXT,
      "AgentID" TEXT,
      "FireEyeGeneratedTime" TEXT,
      "Name" TEXT,
      "VirtualPath" TEXT,
      "ExitCode" INTEGER,
      "CreationDate" TEXT,
      "Comment" TEXT,
      "Creator" TEXT,
      "MaxRunTime" TEXT,
      "Flag" TEXT,
      "AccountName" TEXT,
      "AccountRunLevel" TEXT,
      "AccountLogonType" TEXT,
      "MostRecentRunTime" TEXT,
      "NextRunTime" TEXT,
      "Status" TEXT,
      "ActionList.Action.ActionType" TEXT,
      "ActionList.Action.COMClassId" TEXT,
      "ActionList.Action.COMData" TEXT,
      "ActionList.Action.DigitalSignature.CertificateIssuer" TEXT,
      "ActionList.Action.DigitalSignature.CertificateSubject" TEXT,
      "ActionList.Action.DigitalSignature.Description" TEXT,
      "ActionList.Action.DigitalSignature.SignatureExists" TEXT,
      "ActionList.Action.DigitalSignature.SignatureVerified" TEXT,
      "ActionList.Action.ExecArguments" TEXT,
      "ActionList.Action.ExecProgramMd5sum" TEXT,
      "ActionList.Action.ExecProgramPath" TEXT,
      "ActionList.Action.ExecWorkingDirectory" TEXT,
      "TriggerList" REAL,
      "TriggerList.Trigger.TriggerBegin" TEXT,
      "TriggerList.Trigger.TriggerDelay" TEXT,
      "TriggerList.Trigger.TriggerEnabled" TEXT,
      "TriggerList.Trigger.TriggerEnd" TEXT,
      "TriggerList.Trigger.TriggerFrequency" TEXT,
      "TriggerList.Trigger.TriggerMaxRunTime" TEXT,
      "TriggerList.Trigger.TriggerSessionChangeType" TEXT,
      "TriggerList.Trigger.TriggerSubscription" TEXT
    );
    CREATE TABLE "scripting_persistence" (
      "Tag" REAL,
      "Notes" REAL,
      "Hostname" TEXT,
      "AgentID" TEXT,
      "FireEyeGeneratedTime" TEXT,
      "PersistenceType" TEXT,
      "status" TEXT,
      "serviceDLLCertificateIssuer" TEXT,
      "md5sum" TEXT,
      "TaskFileName" REAL,
      "SignatureVerified" INTEGER,
      "RegistryItem" REAL,
      "pathSignatureDescription" TEXT,
      "mode" TEXT,
      "CertificateIssuer" TEXT,
      "serviceDLLCertificateSubject" TEXT,
      "RegOwner" TEXT,
      "MagicHeader" REAL,
      "detectedAnomaly" REAL,
      "Scheduled" REAL,
      "FileModified" TEXT,
      "pathSignatureVerified" INTEGER,
      "serviceDLL" TEXT,
      "FileCreated" TEXT,
      "arguments" TEXT,
      "ServiceItem" REAL,
      "SignatureExists" INTEGER,
      "FileOwner" TEXT,
      "FileChanged" TEXT,
      "startedAs" TEXT,
      "FileItem" REAL,
      "SignatureDescription" TEXT,
      "serviceDLLmd5sum" TEXT,
      "Created" REAL,
      "RegText" TEXT,
      "pathmd5sum" TEXT,
      "TaskStatus" REAL,
      "RegModified" TEXT,
      "ServiceName" TEXT,
      "Command" REAL,
      "TaskFullPath" REAL,
      "ServicePath" TEXT,
      "TaskName" REAL,
      "pathCertificateIssuer" TEXT,
      "serviceDLLSignatureExists" INTEGER,
      "LastRun" REAL,
      "serviceDLLSignatureDescription" TEXT,
      "serviceDLLMagicHeader" REAL,
      "pathMagicHeader" REAL,
      "FilePath" TEXT,
      "pathCertificateSubject" TEXT,
      "FileAccessed" TEXT,
      "descriptiveName" TEXT,
      "CertificateSubject" TEXT,
      "serviceDLLSignatureVerified" INTEGER,
      "pathSignatureExists" INTEGER,
      "RegPath" TEXT,
      "FileItem.Accessed" TEXT,
      "FileItem.Changed" TEXT,
      "FileItem.Created" TEXT,
      "FileItem.DevicePath" TEXT,
      "FileItem.Drive" TEXT,
      "FileItem.FileAttributes" TEXT,
      "FileItem.FileExtension" TEXT,
      "FileItem.FileName" TEXT,
      "FileItem.FilePath" TEXT,
      "FileItem.FullPath" TEXT,
      "FileItem.Md5sum" TEXT,
      "FileItem.Modified" TEXT,
      "FileItem.PeakCodeEntropy" REAL,
      "FileItem.PeakEntropy" REAL,
      "FileItem.PEInfo.BaseAddress" REAL,
      "FileItem.PEInfo.DetectedAnomalies.string" TEXT,
      "FileItem.PEInfo.DigitalSignature.CertificateChain" TEXT,
      "FileItem.PEInfo.DigitalSignature.CertificateIssuer" TEXT,
      "FileItem.PEInfo.DigitalSignature.CertificateSubject" TEXT,
      "FileItem.PEInfo.DigitalSignature.Description" TEXT,
      "FileItem.PEInfo.DigitalSignature.SignatureExists" INTEGER,
      "FileItem.PEInfo.DigitalSignature.SignatureVerified" INTEGER,
      "FileItem.PEInfo.Exports.DllName" TEXT,
      "FileItem.PEInfo.Exports.ExportedFunctions.string" TEXT,
      "FileItem.PEInfo.Exports.ExportsTimeStamp" TEXT,
      "FileItem.PEInfo.Exports.NumberOfFunctions" REAL,
      "FileItem.PEInfo.Exports.NumberOfNames" REAL,
      "FileItem.PEInfo.ExtraneousBytes" REAL,
      "FileItem.PEInfo.ImportedModules.Module.ImportedFunctions.string" TEXT,
      "FileItem.PEInfo.ImportedModules.Module.Name" TEXT,
      "FileItem.PEInfo.ImportedModules.Module.NumberOfFunctions" TEXT,
      "FileItem.PEInfo.PEChecksum.PEComputedAPI" REAL,
      "FileItem.PEInfo.PEChecksum.PEFileAPI" REAL,
      "FileItem.PEInfo.PEChecksum.PEFileRaw" REAL,
      "FileItem.PEInfo.PETimeStamp" TEXT,
      "FileItem.PEInfo.ResourceInfoList.ResourceInfoItem.Language" TEXT,
      "FileItem.PEInfo.ResourceInfoList.ResourceInfoItem.Name" TEXT,
      "FileItem.PEInfo.ResourceInfoList.ResourceInfoItem.Size" TEXT,
      "FileItem.PEInfo.ResourceInfoList.ResourceInfoItem.Type" TEXT,
      "FileItem.PEInfo.Sections.ActualNumberOfSections" REAL,
      "FileItem.PEInfo.Sections.NumberOfSections" REAL,
      "FileItem.PEInfo.Sections.Section.DetectedCharacteristics" TEXT,
      "FileItem.PEInfo.Sections.Section.Entropy" TEXT,
      "FileItem.PEInfo.Sections.Section.Name" TEXT,
      "FileItem.PEInfo.Sections.Section.SizeInBytes" TEXT,
      "FileItem.PEInfo.Sections.Section.Type" TEXT,
      "FileItem.PEInfo.Subsystem" TEXT,
      "FileItem.PEInfo.Type" TEXT,
      "FileItem.PEInfo.VersionInfoList.VersionInfoItem.Comments" TEXT,
      "FileItem.PEInfo.VersionInfoList.VersionInfoItem.CompanyName" TEXT,
      "FileItem.PEInfo.VersionInfoList.VersionInfoItem.FileDescription" TEXT,
      "FileItem.PEInfo.VersionInfoList.VersionInfoItem.FileVersion" TEXT,
      "FileItem.PEInfo.VersionInfoList.VersionInfoItem.InternalName" TEXT,
      "FileItem.PEInfo.VersionInfoList.VersionInfoItem.Language" TEXT,
      "FileItem.PEInfo.VersionInfoList.VersionInfoItem.LegalCopyright" TEXT,
      "FileItem.PEInfo.VersionInfoList.VersionInfoItem.LegalTrademarks" TEXT,
      "FileItem.PEInfo.VersionInfoList.VersionInfoItem.OriginalFilename" TEXT,
      "FileItem.PEInfo.VersionInfoList.VersionInfoItem.PrivateBuild" TEXT,
      "FileItem.PEInfo.VersionInfoList.VersionInfoItem.ProductName" TEXT,
      "FileItem.PEInfo.VersionInfoList.VersionInfoItem.ProductVersion" TEXT,
      "FileItem.PEInfo.VersionInfoList.VersionInfoItem.SpecialBuild" TEXT,
      "FileItem.SecurityID" TEXT,
      "FileItem.SecurityType" TEXT,
      "FileItem.SizeInBytes" REAL,
      "FileItem.Username" TEXT,
      "RegContext" TEXT,
      "RegistryItem.Hive" TEXT,
      "RegistryItem.KeyPath" TEXT,
      "RegistryItem.Modified" TEXT,
      "RegistryItem.Path" TEXT,
      "RegistryItem.ReportedLengthInBytes" REAL,
      "RegistryItem.SecurityID" TEXT,
      "RegistryItem.Text" TEXT,
      "RegistryItem.Type" TEXT,
      "RegistryItem.Username" TEXT,
      "RegistryItem.Value" TEXT,
      "RegistryItem.ValueName" TEXT,
      "RegValue" TEXT,
      "ServiceItem.arguments" TEXT,
      "ServiceItem.description" TEXT,
      "ServiceItem.descriptiveName" TEXT,
      "ServiceItem.mode" TEXT,
      "ServiceItem.name" TEXT,
      "ServiceItem.path" TEXT,
      "ServiceItem.pathCertificateChain" TEXT,
      "ServiceItem.pathCertificateIssuer" TEXT,
      "ServiceItem.pathCertificateSubject" TEXT,
      "ServiceItem.pathmd5sum" TEXT,
      "ServiceItem.pathSignatureDescription" TEXT,
      "ServiceItem.pathSignatureExists" INTEGER,
      "ServiceItem.pathSignatureVerified" INTEGER,
      "ServiceItem.pid" REAL,
      "ServiceItem.serviceDLL" TEXT,
      "ServiceItem.serviceDLLCertificateIssuer" TEXT,
      "ServiceItem.serviceDLLCertificateSubject" TEXT,
      "ServiceItem.serviceDLLmd5sum" TEXT,
      "ServiceItem.serviceDLLSignatureDescription" TEXT,
      "ServiceItem.serviceDLLSignatureExists" INTEGER,
      "ServiceItem.serviceDLLSignatureVerified" INTEGER,
      "ServiceItem.startedAs" TEXT,
      "ServiceItem.status" TEXT,
      "ServiceItem.type" TEXT
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
    model: azure('selector'),
    initial: <SpinnerMessage />,
    system: `\
    You are a query optimization assistant. From the following 3 SQLite queries, choose the best one in regards to the users question and the SQL schema.
    Return it as unformatted response without markdown!
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
        console.log("Selected Query:" + query)
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
