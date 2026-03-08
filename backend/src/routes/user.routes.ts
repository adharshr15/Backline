import { Router } from 'express'
import { getUsers, getUserById, createUser, updateUser, deleteUser } from '../controllers/user.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

// public routes (registration)
router.post('/', createUser)

// protected routes
router.use(authenticate)
router.get('/', getUsers)
router.get('/:id', getUserById)
router.put("/:id", updateUser)  
router.delete("/:id", deleteUser)

export default router