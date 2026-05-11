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

//Find User's Posts
app.get('/user/posts', async (req, res) => {
    const userId = req.query.userId
    const authorId = req.query.authorId
    if (!userId){
        return res.status(400).json({message:"Id de Usuário não informado"})
    }
    if (!authorId){
        return res.status(400).json({message:"Id de Autor não informado"})
    }

    const allPosts = await prisma.post.findMany({
            where:      { authorId, OR: [ { parentId: null }, { parentId: { isSet: false } }]},
            orderBy:    { id: "desc" },
            include:    { author: true }
    })

    const postIds = allPosts.map(p => p.id)

    const reactions = await prisma.reaction.groupBy({
        by: ["postId", "type"],
        where: {
        postId: { in: postIds }
        },
        _count: {
        type: true
        }
    })

    const userReactions = await prisma.reaction.findMany({
        where: {
            userId,
            postId: { in: postIds }
        },
        select: {
            postId: true,
            type: true
        }
    })

    // Criar um mapa: { postId: { likes, dislikes } }
    const reactionMap = {}

    for (const r of reactions) {
        if (!reactionMap[r.postId]) {
        reactionMap[r.postId] = { likes: 0, dislikes: 0 }
        }

        if (r.type === "LIKE") {
        reactionMap[r.postId].likes = r._count.type
        }

        if (r.type === "DISLIKE") {
        reactionMap[r.postId].dislikes = r._count.type
        }
    }

    const userReactionMap = {}

    for (const r of userReactions) {
        userReactionMap[r.postId] = r.type
    }

    const result = allPosts.map(post => ({
        ...post,
        likes: reactionMap[post.id]?.likes || 0,
        dislikes: reactionMap[post.id]?.dislikes || 0,
        userReaction: userReactionMap[post.id] || null
    }))

    res.send(result)
})

//Find single user
app.get('/user/:id', async (req, res) => {
    const { id } = req.params
    const User = await prisma.user.findFirst({
        where:{id}
    })
    res.send(User)
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
    const {
        userId,
        magnitude,
        tema,
        tipo,
        impacto,
        custo
    } = req.query


    if (!userId){
        return res.status(400).json({message:"Id de Usuário não informado"})
    }

    const filters = {
        OR: [
            { parentId: null },
            { parentId: { isSet: false } }
        ]
    }

    if (magnitude) filters.magnitude = magnitude
    if (tema) filters.tema = tema
    if (tipo) filters.tipo = tipo
    if (impacto) filters.impacto = impacto
    if (custo) filters.custo = custo

    const allPosts = await prisma.post.findMany({
            where:       filters ,
            orderBy:    { id: "desc" },
            include:    { author: true }
    })

    const postIds = allPosts.map(p => p.id)

    const reactions = await prisma.reaction.groupBy({
        by: ["postId", "type"],
        where: {
        postId: { in: postIds }
        },
        _count: {
        type: true
        }
    })

    const userReactions = await prisma.reaction.findMany({
        where: {
            userId,
            postId: { in: postIds }
        },
        select: {
            postId: true,
            type: true
        }
    })

    // Criar um mapa: { postId: { likes, dislikes } }
    const reactionMap = {}

    for (const r of reactions) {
        if (!reactionMap[r.postId]) {
        reactionMap[r.postId] = { likes: 0, dislikes: 0 }
        }

        if (r.type === "LIKE") {
        reactionMap[r.postId].likes = r._count.type
        }

        if (r.type === "DISLIKE") {
        reactionMap[r.postId].dislikes = r._count.type
        }
    }

    const userReactionMap = {}

    for (const r of userReactions) {
        userReactionMap[r.postId] = r.type
    }

    const result = allPosts.map(post => ({
        ...post,
        likes: reactionMap[post.id]?.likes || 0,
        dislikes: reactionMap[post.id]?.dislikes || 0,
        userReaction: userReactionMap[post.id] || null
    }))

    res.send(result)
})

//Find single Post
app.get('/post/:id', async (req, res) => {
    const { id } = req.params
    const userId = req.query.userId

    if (!userId) {
        return res.status(400).json({ message: "Id de Usuário não informado" })
    }

    const post = await prisma.post.findUnique({
        where: { id },
        include: { author: true }
    })

    if (!post) {
        return res.status(404).json({ message: "Post não encontrado" })
    }

    const [likes, dislikes, userReaction] = await Promise.all([
        prisma.reaction.count({
        where: { postId: id, type: "LIKE" }
        }),
        prisma.reaction.count({
        where: { postId: id, type: "DISLIKE" }
        }),
        prisma.reaction.findUnique({
        where: {
            userId_postId: {
            userId,
            postId: id
            }
        },
        select: {
            type: true
        }
        })
    ])

    res.send({
        ...post,
        likes,
        dislikes,
        userReaction: userReaction?.type || null
    })
})

//Find all Comments from a Post
app.get('/allcomments/:idParent', async (req, res) => {
    const { idParent } = req.params
    const userId = req.query.userId
    if (!userId){
        return res.status(400).json({message:"Id de Usuário não informado"})
    }

    const allPosts = await prisma.post.findMany(
        {
            where: { parentId: idParent },
            orderBy: { id: "desc" },
            include:{ author: true }
        })

    const postIds = allPosts.map(p => p.id)

    const reactions = await prisma.reaction.groupBy({
        by: ["postId", "type"],
        where: {
        postId: { in: postIds }
        },
        _count: {
        type: true
        }
    })

    const userReactions = await prisma.reaction.findMany({
        where: {
            userId,
            postId: { in: postIds }
        },
        select: {
            postId: true,
            type: true
        }
    })

    // Criar um mapa: { postId: { likes, dislikes } }
    const reactionMap = {}

    for (const r of reactions) {
        if (!reactionMap[r.postId]) {
        reactionMap[r.postId] = { likes: 0, dislikes: 0 }
        }

        if (r.type === "LIKE") {
        reactionMap[r.postId].likes = r._count.type
        }

        if (r.type === "DISLIKE") {
        reactionMap[r.postId].dislikes = r._count.type
        }
    }

    const userReactionMap = {}

    for (const r of userReactions) {
        userReactionMap[r.postId] = r.type
    }

    const result = allPosts.map(post => ({
        ...post,
        likes: reactionMap[post.id]?.likes || 0,
        dislikes: reactionMap[post.id]?.dislikes || 0,
        userReaction: userReactionMap[post.id] || null
    }))

    res.send(result)
})

//Mark Reaction
app.post('/reaction', async (req, res) => {
    const { userId, postId, type } = req.body

    if (!userId || !postId || !type) {
        return res.status(400).json({ message: "Dados inválidos" })
    }

    try{
        const existing = await prisma.reaction.findFirst({
            where: {
                userId,
                postId
            }
        })

        if (!existing) {
            const reaction = await prisma.reaction.create({
                data: { userId, postId, type }
            })

            return res.json({ action: "created", reaction })
        }

        if (existing.type === type) {
        await prisma.reaction.delete({
            where: { id: existing.id }
        })

        return res.json({ action: "removed" })
        }
        
        const updated = await prisma.reaction.update({
            where: { id: existing.id },
            data: { type }
        })

        return res.json({ action: "updated", reaction: updated })
    } catch (error){
        console.error(error)
        res.status(500).json({ message: "Erro ao processar reação" })
    }
})

app.listen(3000, () => {
    console.log("Running in: 3000")
})