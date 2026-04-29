import express from 'express'
import { PrismaClient } from "@prisma/client";
import cors from 'cors'
import { send2FACodeEmail } from "./mail.js"

const app = express()
app.use(express.json())

//Access to backend
app.use(cors())

const prisma = new PrismaClient();

app.get('/test', (req, res) => {
    res.send('Server is runnning')
})

//Find all users
app.get('/allusers', async (req, res) => {
    const allUsers = await prisma.user.findMany()
    res.send(allUsers)
})

//Create Users
app.post('/users', async (req, res) => {

    const newUser = await prisma.user.create({
        data: req.body
    })

    res.json(newUser)

})

//Login
app.post('/login', async (req, res) => {
    const { email, password }=req.body
    try{
        const user = await prisma.user.findFirst({
            where:{
                email : email,
                password : password
            }
        })

        if (!user){
            return res.status(401).send({ message: "Email ou senha inválidos" })
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString()

        await prisma.user.update({
            where: { email },
            data: {
                twoFactorCode: code,
                twoFactorExpires: new Date(Date.now() + 5 * 60 * 1000) // 5 min
            }
        })

        await send2FACodeEmail(email, code)

        return res.status(200).send({
        message: "Login realizado com sucesso",
        user_id: user.id
        })    
    } catch(error){
        console.log(error)
        res.status(500).send({message : "Erro no Servidor"})
    }
})

//Verify 2FA code
app.post('/verify-code', async (req, res) => {
  const { userId, code } = req.body

  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (
    !user ||
    user.twoFactorCode !== code ||
    user.twoFactorExpires < new Date()
  ) {
    return res.status(401).send({ message: "Código inválido ou expirado" })
  }

  // limpa código
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorCode: null,
      twoFactorExpires: null
    }
  })

  return res.send({ message: "Login completo" })
})

//Create post
app.post('/posts', async (req, res) => {

    const newPost = await prisma.post.create({
        data: req.body
    })

    res.json(newPost)

})

//Find all Posts
app.get('/allposts', async (req, res) => {
    const allPosts = await prisma.post.findMany({
            where:      { OR: [ { parentId: null }, { parentId: { isSet: false } }]},
            orderBy:    { id: "desc" },
            include:    { author: true }
    })
    res.send(allPosts)
})

//Find single Post
app.get('/post/:id', async (req, res) => {
    const { id } = req.params
    const allPosts = await prisma.post.findUnique({
            where: { id },
            include:{ author: true }
    })
    res.send(allPosts)
})

//Find all Comments from a Post
app.get('/allcomments/:idParent', async (req, res) => {
    const { idParent } = req.params
    const allPosts = await prisma.post.findMany(
        {
            where: { parentId: idParent },
            orderBy: { id: "desc" },
            include:{ author: true }
        })
    res.send(allPosts)
})

app.listen(3000, () => {
    console.log("Running in: 3000")
})