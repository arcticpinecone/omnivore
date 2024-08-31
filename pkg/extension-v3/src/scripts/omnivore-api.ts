import { ArticleData, SavePageData, SetLinkArchivedData } from './types'
import { getStorageItem } from './utils'

const apiUrl = process.env.OMNIVORE_GRAPHQL_URL ?? ''

export type ApiResult = 'success' | 'failure' | 'unauthorized'

const gqlRequest = async (query: string) => {
  const apiKey = (await getStorageItem('apiKey')) as string | undefined
  let headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  } as Record<string, string>
  if (apiKey) {
    headers['Authorization'] = apiKey
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      redirect: 'follow',
      credentials: 'include',
      mode: 'cors',
      headers,
      body: query,
    })
    const json = await response.json()
    if (!('data' in json) || !json.data) {
      throw new Error('No response data')
    }
    return json.data
  } catch (err) {
    console.log('[omnivore] error making api request: ', query)
  }
}

export async function savePageRequest(input: {
  url: string
  title: string
  clientRequestId: string
  originalContent: string
}) {
  const mutation = JSON.stringify({
    query: `mutation SavePage ($input: SavePageInput!) {
      savePage(input:$input){
        ... on SaveSuccess {
          url
          clientRequestId
        }
        ... on SaveError {
          errorCodes
        }
      }
    }`,
    variables: {
      input: {
        source: 'extension',
        ...input,
      },
    },
  })

  const data = (await gqlRequest(mutation)) as SavePageData
  if (data.savePage?.errorCodes?.length) {
    console.log('[omnivore] api: error saving page:', data)
    if (data.savePage.errorCodes.indexOf('UNAUTHORIZED') > -1) {
      console.log('[omnivore] api is not authorized')
      return { result: 'unauthorized' }
    }
    return { result: 'failure' }
  }
  return { result: 'success', libraryItemId: data.savePage?.clientRequestId }
}

export async function addNoteToLibraryItem(input: {
  libraryItemId: string
  note: string
}) {
  const query = JSON.stringify({
    query: `query GetArticle(
      $username: String!
      $slug: String!
      $includeFriendsHighlights: Boolean
    ) {
      article(username: $username, slug: $slug) {
        ... on ArticleSuccess {
          article {
            highlights(input: { includeFriends: $includeFriendsHighlights }) {
              ...HighlightFields
            }
          }
        }
        ... on ArticleError {
          errorCodes
        }
      }
    }
    fragment HighlightFields on Highlight {
      id
      type
      annotation
    }
    `,
    variables: {
      username: 'me',
      slug: input.libraryItemId,
      includeFriendsHighlights: false,
    },
  })

  const data = (await gqlRequest(query)) as ArticleData
  if (data.article?.errorCodes?.length) {
    console.log('[omnivore] api: error getting article:', data)
    if (data.article.errorCodes.indexOf('UNAUTHORIZED') > -1) {
      console.log('[omnivore] api is not authorized')
      return 'unauthorized'
    }
    return 'failure'
  }

  console.log('DATA.ARTICLE: ', data.article)
  const existingNote = data.article?.highlights?.find((h) => h.type == 'NOTE')

  // if (existingNote) {
  //   const mutation = JSON.stringify({
  //     query: `
  //     mutation UpdateHighlight($input: UpdateHighlightInput!) {
  //       updateHighlight(input: $input) {
  //         ... on UpdateHighlightSuccess {
  //           highlight {
  //             id
  //           }
  //         }
  //         ... on UpdateHighlightError {
  //           errorCodes
  //         }
  //       }
  //     }
  //   `,
  //     variables: {
  //       input: {
  //         highlightId: existingNote.id,
  //         annotation: existingNote.annotation
  //           ? existingNote.annotation + '\n\n' + note
  //           : note,
  //       },
  //     },
  //   })
  //   const result = await gqlRequest(apiUrl, mutation)
  //   if (
  //     !result.updateHighlight ||
  //     result.updateHighlight['errorCodes'] ||
  //     !result.updateHighlight.highlight
  //   ) {
  //     console.log('GQL Error updating note:', result)
  //     return
  //   }
  //   return result.updateHighlight.highlight.id
  // } else {
  //   const mutation = JSON.stringify({
  //     query: `
  //     mutation CreateHighlight($input: CreateHighlightInput!) {
  //       createHighlight(input: $input) {
  //         ... on CreateHighlightSuccess {
  //           highlight {
  //             id
  //           }
  //         }
  //         ... on CreateHighlightError {
  //           errorCodes
  //         }
  //       }
  //     }
  //   `,
  //     variables: {
  //       input: {
  //         id: noteId,
  //         shortId: shortId,
  //         type: 'NOTE',
  //         articleId: pageId,
  //         annotation: note,
  //       },
  //     },
  //   })
  //   const result = await gqlRequest(apiUrl, mutation)
  //   if (
  //     !result.createHighlight ||
  //     result.createHighlight['errorCodes'] ||
  //     !result.createHighlight.highlight
  //   ) {
  //     console.log('GQL Error setting note:', result)
  //     return
  //   }
  //   return result.createHighlight.highlight.id
  // }
  return 'success'
}

// async function updateLabelsCache(apiUrl, tab) {
//   const query = JSON.stringify({
//     query: `query GetLabels {
//       labels {
//         ... on LabelsSuccess {
//           labels {
//             ...LabelFields
//           }
//         }
//         ... on LabelsError {
//           errorCodes
//         }
//       }
//     }
//     fragment LabelFields on Label {
//       id
//       name
//       color
//       description
//       createdAt
//     }
//     `,
//   })

//   const data = await gqlRequest(apiUrl, query)
//   if (!data.labels || data.labels['errorCodes'] || !data.labels['labels']) {
//     console.log('GQL Error updating label cache response:', data, data)
//     console.log(!data.labels, data.labels['errorCodes'], !data.labels['labels'])
//     return []
//   }

//   await setStorage({
//     labels: data.labels.labels,
//     labelsLastUpdated: new Date().toISOString(),
//   })

//   return data.labels.labels
// }

// async function updatePageTitle(apiUrl, pageId, title) {
//   const mutation = JSON.stringify({
//     query: `mutation UpdatePage($input: UpdatePageInput!) {
//       updatePage(input: $input) {
//         ... on UpdatePageSuccess {
//           updatedPage {
//             id
//           }
//         }
//         ... on UpdatePageError {
//           errorCodes
//         }
//       }
//     }
//   `,
//     variables: {
//       input: {
//         pageId,
//         title,
//       },
//     },
//   })

//   const data = await gqlRequest(apiUrl, mutation)
//   if (
//     !data.updatePage ||
//     data.updatePage['errorCodes'] ||
//     !data.updatePage['updatedPage']
//   ) {
//     console.log('GQL Error updating page:', data)
//     throw new Error('Error updating title.')
//   }
//   return data.updatePage.updatePage
// }

// async function setLabels(apiUrl, pageId, labels) {
//   const mutation = JSON.stringify({
//     query: `mutation SetLabels($input: SetLabelsInput!) {
//       setLabels(input: $input) {
//         ... on SetLabelsSuccess {
//           labels {
//             id
//             name
//             color
//           }
//         }
//         ... on SetLabelsError {
//           errorCodes
//         }
//       }
//     }
//   `,
//     variables: {
//       input: {
//         pageId,
//         labels,
//       },
//     },
//   })

//   const data = await gqlRequest(apiUrl, mutation)
//   if (
//     !data.setLabels ||
//     data.setLabels['errorCodes'] ||
//     !data.setLabels['labels']
//   ) {
//     console.log('GQL Error setting labels:', data)
//     throw new Error('Error setting labels.')
//   }

//   await appendLabelsToCache(data.setLabels.labels)

//   return data.setLabels.labels
// }

// async function appendLabelsToCache(labels) {
//   const cachedLabels = await getStorageItem('labels')
//   if (cachedLabels) {
//     labels.forEach((l) => {
//       const existing = cachedLabels.find((cached) => cached.name === l.name)
//       if (!existing) {
//         cachedLabels.unshift(l)
//       }
//     })

//     await setStorage({
//       labels: cachedLabels,
//       labelsLastUpdated: new Date().toISOString(),
//     })
//   } else {
//     await setStorage({
//       labels: labels,
//       labelsLastUpdated: new Date().toISOString(),
//     })
//   }
// }

// async function addNote(apiUrl, pageId, noteId, shortId, note) {
//   const query = JSON.stringify({
//     query: `query GetArticle(
//       $username: String!
//       $slug: String!
//       $includeFriendsHighlights: Boolean
//     ) {
//       article(username: $username, slug: $slug) {
//         ... on ArticleSuccess {
//           article {
//             highlights(input: { includeFriends: $includeFriendsHighlights }) {
//               ...HighlightFields
//             }
//           }
//         }
//         ... on ArticleError {
//           errorCodes
//         }
//       }
//     }
//     fragment HighlightFields on Highlight {
//       id
//       type
//       annotation
//     }
//     `,
//     variables: {
//       username: 'me',
//       slug: pageId,
//       includeFriendsHighlights: false,
//     },
//   })

//   const data = await gqlRequest(apiUrl, query)
//   if (!data.article || data.article['errorCodes'] || !data.article['article']) {
//     console.log('GQL Error getting existing highlights:', data)
//     return
//   }

//   const existingNote = data.article.article.highlights.find(
//     (h) => h.type == 'NOTE'
//   )

//   if (existingNote) {
//     const mutation = JSON.stringify({
//       query: `
//       mutation UpdateHighlight($input: UpdateHighlightInput!) {
//         updateHighlight(input: $input) {
//           ... on UpdateHighlightSuccess {
//             highlight {
//               id
//             }
//           }
//           ... on UpdateHighlightError {
//             errorCodes
//           }
//         }
//       }
//     `,
//       variables: {
//         input: {
//           highlightId: existingNote.id,
//           annotation: existingNote.annotation
//             ? existingNote.annotation + '\n\n' + note
//             : note,
//         },
//       },
//     })
//     const result = await gqlRequest(apiUrl, mutation)
//     if (
//       !result.updateHighlight ||
//       result.updateHighlight['errorCodes'] ||
//       !result.updateHighlight.highlight
//     ) {
//       console.log('GQL Error updating note:', result)
//       return
//     }
//     return result.updateHighlight.highlight.id
//   } else {
//     const mutation = JSON.stringify({
//       query: `
//       mutation CreateHighlight($input: CreateHighlightInput!) {
//         createHighlight(input: $input) {
//           ... on CreateHighlightSuccess {
//             highlight {
//               id
//             }
//           }
//           ... on CreateHighlightError {
//             errorCodes
//           }
//         }
//       }
//     `,
//       variables: {
//         input: {
//           id: noteId,
//           shortId: shortId,
//           type: 'NOTE',
//           articleId: pageId,
//           annotation: note,
//         },
//       },
//     })
//     const result = await gqlRequest(apiUrl, mutation)
//     if (
//       !result.createHighlight ||
//       result.createHighlight['errorCodes'] ||
//       !result.createHighlight.highlight
//     ) {
//       console.log('GQL Error setting note:', result)
//       return
//     }
//     return result.createHighlight.highlight.id
//   }
// }

export const archiveLibraryItem = async (
  libraryItemId: string
): Promise<ApiResult> => {
  const mutation = JSON.stringify({
    query: `mutation SetLinkArchived($input: ArchiveLinkInput!) {
      setLinkArchived(input: $input) {
        ... on ArchiveLinkSuccess {
          linkId
          message
        }
        ... on ArchiveLinkError {
          message
          errorCodes
        }
      }
    }
  `,
    variables: {
      input: {
        linkId: libraryItemId,
        archived: true,
      },
    },
  })

  const data = (await gqlRequest(mutation)) as SetLinkArchivedData
  if (data.setLinkArchived?.errorCodes?.length) {
    console.log('[omnivore] api: error getting article:', data)
    if (data.setLinkArchived.errorCodes.indexOf('UNAUTHORIZED') > -1) {
      console.log('[omnivore] api is not authorized')
      return 'unauthorized'
    }
    return 'failure'
  }

  return 'success'
}

// async function deleteItem(apiUrl, pageId) {
//   const mutation = JSON.stringify({
//     query: `mutation SetBookmarkArticle($input: SetBookmarkArticleInput!) {
//       setBookmarkArticle(input: $input) {
//         ... on SetBookmarkArticleSuccess {
//           bookmarkedArticle {
//             id
//           }
//         }
//         ... on SetBookmarkArticleError {
//           errorCodes
//         }
//       }
//     }
//   `,
//     variables: {
//       input: {
//         articleID: pageId,
//         bookmark: false,
//       },
//     },
//   })

//   const data = await gqlRequest(apiUrl, mutation)
//   if (
//     !data.setBookmarkArticle ||
//     data.setBookmarkArticle['errorCodes'] ||
//     !data.setBookmarkArticle.bookmarkedArticle
//   ) {
//     console.log('GQL Error deleting:', data)
//     throw new Error('Error deleting.')
//   }
//   return data.setBookmarkArticle.bookmarkedArticle
// }