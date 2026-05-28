import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { options } from './swaggerOptions';

const specs = swaggerJSDoc(options);


import users from './routes/routes_users'
import cuentasYTransacciones from './routes/vistas/routes_cuentas_y_transacciones';
import estadisticaYSesiones from './routes/vistas/routes_estadistica_y_seciones';
import tarjeta from './routes/routes_tarjeta';
import  transacciones from './routes/routes_transacciones';
import actividad from './routes/routes_actividad';
import login from './routes/routes_login';
import cuentas from './routes/routes_cuentas';
import colas from './routes/routes_colas';
import { medirTiempoServicio } from "./controlers/colas.js";

import admin from './routes/Admin.js';

const app = express();




app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(medirTiempoServicio);

app.use(users);
app.use(cuentasYTransacciones);
app.use(estadisticaYSesiones);
app.use(tarjeta);
app.use(transacciones);
app.use(actividad);

app.use(admin);

app.use(login);
app.use(cuentas);

app.use(colas);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs));



export default app;