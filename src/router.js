import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
import Gallery from './views/Gallery.vue'
import Settings from './views/Settings.vue'
import Preview from './views/Preview.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home
    },
    {
      path: '/gallery',
      name: 'gallery',
      component: Gallery
    },
    {
      path: '/settings',
      name: 'settings',
      component: Settings
    },
    {
      path: '/preview',
      name: 'preview',
      component: Preview
    }
  ]
})

export default router 