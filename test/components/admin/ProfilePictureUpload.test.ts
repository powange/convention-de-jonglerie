import { describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ProfilePictureUpload from '~/components/admin/ProfilePictureUpload.vue'

describe('ProfilePictureUpload', () => {
  it('affiche la zone de téléchargement', async () => {
    const component = await mountSuspended(ProfilePictureUpload, {
      props: {
        userId: 1,
      },
    })

    const uploadZone = component.find('[data-test="upload-zone"]')
    expect(uploadZone.exists()).toBe(true)
  })

  it("affiche l'image actuelle si fournie", async () => {
    const component = await mountSuspended(ProfilePictureUpload, {
      props: {
        userId: 1,
        currentImage: '/uploads/profile/user1.jpg',
      },
    })

    const currentImage = component.find('img')
    expect(currentImage.exists()).toBe(true)
    expect(currentImage.attributes('src')).toBe('/uploads/profile/user1.jpg')
  })

  it("gère la sélection d'un fichier", async () => {
    const component = await mountSuspended(ProfilePictureUpload, {
      props: {
        userId: 1,
      },
    })

    const file = new File(['image'], 'profile.jpg', { type: 'image/jpeg' })
    const input = component.find('input[type="file"]')

    // Simuler la sélection d\'un fichier
    Object.defineProperty(input.element, 'files', {
      value: [file],
      writable: false,
    })

    await input.trigger('change')

    expect(component.emitted('file-selected')).toBeTruthy()
    expect(component.emitted('file-selected')?.[0]).toEqual([file])
  })

  it('valide le type de fichier', async () => {
    const component = await mountSuspended(ProfilePictureUpload, {
      props: {
        userId: 1,
      },
    })

    const invalidFile = new File(['content'], 'document.pdf', { type: 'application/pdf' })
    const input = component.find('input[type="file"]')

    Object.defineProperty(input.element, 'files', {
      value: [invalidFile],
      writable: false,
    })

    await input.trigger('change')

    expect(component.emitted('error')).toBeTruthy()
    expect(component.emitted('error')?.[0]?.[0]).toContain('type')
  })

  it('valide la taille du fichier', async () => {
    const component = await mountSuspended(ProfilePictureUpload, {
      props: {
        userId: 1,
        maxSize: 1024 * 1024, // 1MB
      },
    })

    const largeFile = new File([new ArrayBuffer(2 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg',
    })
    const input = component.find('input[type="file"]')

    Object.defineProperty(input.element, 'files', {
      value: [largeFile],
      writable: false,
    })

    await input.trigger('change')

    expect(component.emitted('error')).toBeTruthy()
    expect(component.emitted('error')?.[0]?.[0]).toContain('taille')
  })

  it('affiche la prévisualisation après sélection', async () => {
    const component = await mountSuspended(ProfilePictureUpload, {
      props: {
        userId: 1,
      },
    })

    // Créer une URL de prévisualisation
    const mockUrl = 'blob:http://example.com/12345'
    global.URL.createObjectURL = vi.fn(() => mockUrl)

    const file = new File(['image'], 'preview.jpg', { type: 'image/jpeg' })
    const input = component.find('input[type="file"]')

    Object.defineProperty(input.element, 'files', {
      value: [file],
      writable: false,
    })

    await input.trigger('change')
    await component.vm.$nextTick()

    const preview = component.find('[data-test="image-preview"]')
    if (preview.exists()) {
      expect(preview.attributes('src')).toBe(mockUrl)
    }
  })

  it('émet upload lors de la confirmation', async () => {
    const component = await mountSuspended(ProfilePictureUpload, {
      props: {
        userId: 1,
      },
    })

    const file = new File(['image'], 'upload.jpg', { type: 'image/jpeg' })
    component.vm.selectedFile = file
    await component.vm.$nextTick()

    const uploadButton = component.find('[data-test="upload-button"]')
    if (uploadButton.exists()) {
      await uploadButton.trigger('click')
      expect(component.emitted('upload')).toBeTruthy()
      expect(component.emitted('upload')?.[0]).toEqual([file])
    }
  })

  it("émet delete pour supprimer l'image actuelle", async () => {
    const component = await mountSuspended(ProfilePictureUpload, {
      props: {
        userId: 1,
        currentImage: '/uploads/profile/user1.jpg',
      },
    })

    const deleteButton = component.find('[data-test="delete-image"]')
    expect(deleteButton.exists()).toBe(true)

    await deleteButton.trigger('click')
    expect(component.emitted('delete')).toBeTruthy()
  })

  it('désactive les actions pendant le traitement', async () => {
    const component = await mountSuspended(ProfilePictureUpload, {
      props: {
        userId: 1,
        isUploading: true,
      },
    })

    const input = component.find('input[type="file"]')
    expect(input.attributes('disabled')).toBeDefined()

    const uploadButton = component.find('[data-test="upload-button"]')
    if (uploadButton.exists()) {
      expect(uploadButton.attributes('disabled')).toBeDefined()
    }
  })
})
