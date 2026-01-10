import { Router } from 'express';
import {
  listarEmpleados,
  buscarEmpleados,
  obtenerEmpleado,
  crearEmpleado,
  actualizarEmpleado,
  eliminarEmpleado
} from '../controllers/empleado.controller.js';

const router = Router();

// Nota: /buscar antes de /:id
router.get('/buscar', buscarEmpleados);
router.get('/', listarEmpleados);
router.get('/:id', obtenerEmpleado);
router.post('/', crearEmpleado);
router.put('/:id', actualizarEmpleado);
router.delete('/:id', eliminarEmpleado);

export default router;
