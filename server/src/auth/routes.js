import { Router } from 'express'
import { register, login } from './index.js'

const router = Router()

router.post('/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body
    const user = await register(username, password)
    res.json({ user })
  } catch (err) {
    const status = err.code === 'USERNAME_TAKEN' ? 409 : 400
    res.status(status).json({ error: err.message, code: err.code })
  }
})

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const token = await login(username, password)
    res.json({ token })
  } catch (err) {
    res.status(401).json({ error: err.message, code: err.code })
  }
})

export default router
