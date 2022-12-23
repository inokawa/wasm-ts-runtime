import { Buffer } from "./buffer";

export class ModuleNode {
  magic: Uint8Array;
  version: Uint8Array;
  sections: SectionNode[] = [];

  constructor(buffer: Buffer) {
    this.magic = buffer.readBytes(4);
    this.version = buffer.readBytes(4);

    while (true) {
      if (buffer.eof) break;

      this.sections.push(loadSection(buffer));
    }
  }

  store(buffer: Buffer) {
    buffer.writeBytes(this.magic);
    buffer.writeBytes(this.version);

    for (const section of this.sections) {
      section.store(buffer);
    }
  }
}

const TEMP_BUFFER_LENGTH = 1024;

const createTempBuffer = () =>
  new Buffer({
    buffer: new ArrayBuffer(TEMP_BUFFER_LENGTH),
  });

type SectionNode =
  | TypeSectionNode
  | FunctionSectionNode
  | CodeSectionNode
  | ExportSectionNode;

const TYPE_SECTION_ID = 0x01;
const FUNCTION_SECTION_ID = 0x03;
const EXPORT_SECTION_ID = 0x07;
const CODE_SECTION_ID = 0x0a;

const loadSection = (buffer: Buffer): SectionNode => {
  const sectionId = buffer.readByte();
  const sectionSize = buffer.readU32();
  const sectionBuffer = buffer.readBuffer(sectionSize);

  switch (sectionId) {
    case TYPE_SECTION_ID:
      return new TypeSectionNode(sectionBuffer);
    case FUNCTION_SECTION_ID:
      return new FunctionSectionNode(sectionBuffer);
    case EXPORT_SECTION_ID:
      return new ExportSectionNode(sectionBuffer);
    case CODE_SECTION_ID:
      return new CodeSectionNode(sectionBuffer);
    default:
      throw new Error(`invaild section id: ${sectionId}`);
  }
};

export class TypeSectionNode {
  funcTypes: FuncTypeNode[] = [];

  constructor(buffer: Buffer) {
    this.funcTypes = buffer.readVec(() => new FuncTypeNode(buffer));
  }

  store(buffer: Buffer) {
    buffer.writeByte(TYPE_SECTION_ID);
    const sectionsBuffer = createTempBuffer();
    sectionsBuffer.writeVec(this.funcTypes, (funcType) => {
      funcType.store(sectionsBuffer);
    });
    buffer.append(sectionsBuffer);
  }
}

const FUNC_TYPE_TAG = 0x60;

const I32 = 0x7f;
const I64 = 0x7e;
const F32 = 0x7d;
const F64 = 0x7c;
type NumType = typeof I32 | typeof I64 | typeof F32 | typeof F64;
const FUNC_REF = 0x70;
const EXTERN_REF = 0x6f;
type RefType = typeof FUNC_REF | typeof EXTERN_REF;
type ValType = NumType | RefType;

export class FuncTypeNode {
  paramType: ResultTypeNode;
  resultType: ResultTypeNode;

  constructor(buffer: Buffer) {
    if (buffer.readByte() !== FUNC_TYPE_TAG) {
      throw new Error("invalid functype");
    }
    this.paramType = new ResultTypeNode(buffer);
    this.resultType = new ResultTypeNode(buffer);
  }

  store(buffer: Buffer) {
    buffer.writeByte(FUNC_TYPE_TAG);
    this.paramType.store(buffer);
    this.resultType.store(buffer);
  }
}

export class ResultTypeNode {
  valTypes: ValType[] = [];

  constructor(buffer: Buffer) {
    this.valTypes = buffer.readVec(() => buffer.readByte() as ValType);
  }

  store(buffer: Buffer) {
    buffer.writeVec(this.valTypes, (valType) => {
      buffer.writeByte(valType);
    });
  }
}

type TypeIdx = number;

export class FunctionSectionNode {
  typeIdxs: TypeIdx[];

  constructor(buffer: Buffer) {
    this.typeIdxs = buffer.readVec(() => buffer.readU32() as TypeIdx);
  }

  store(buffer: Buffer) {
    buffer.writeByte(FUNCTION_SECTION_ID);
    const sectionsBuffer = createTempBuffer();
    sectionsBuffer.writeVec(this.typeIdxs, (typeIdx) => {
      sectionsBuffer.writeU32(typeIdx);
    });
    buffer.append(sectionsBuffer);
  }
}

export class CodeSectionNode {
  codes: CodeNode[];

  constructor(buffer: Buffer) {
    this.codes = buffer.readVec(() => new CodeNode(buffer));
  }

  store(buffer: Buffer) {
    buffer.writeByte(CODE_SECTION_ID);
    const sectionsBuffer = createTempBuffer();
    sectionsBuffer.writeVec(this.codes, (code) => {
      code.store(sectionsBuffer);
    });
    buffer.append(sectionsBuffer);
  }
}

export class CodeNode {
  size: number;
  func: FuncNode;

  constructor(buffer: Buffer) {
    this.size = buffer.readU32();
    this.func = new FuncNode(buffer.readBuffer(this.size));
  }

  store(buffer: Buffer) {
    const funcBuffer = createTempBuffer();
    this.func.store(funcBuffer);
    buffer.append(funcBuffer);
  }
}

export class FuncNode {
  locals: LocalsNode[] = [];
  expr: ExprNode;

  constructor(buffer: Buffer) {
    this.locals = buffer.readVec(() => new LocalsNode(buffer));
    this.expr = new ExprNode(buffer);
  }

  store(buffer: Buffer) {
    buffer.writeVec(this.locals, (locals) => {
      locals.store(buffer);
    });
    this.expr.store(buffer);
  }
}

export class ExportSectionNode {
  exports: ExportNode[] = [];

  constructor(buffer: Buffer) {
    this.exports = buffer.readVec(() => new ExportNode(buffer));
  }

  store(buffer: Buffer) {
    buffer.writeByte(EXPORT_SECTION_ID);
    const sectionsBuffer = createTempBuffer();
    sectionsBuffer.writeVec(this.exports, (ex) => {
      ex.store(sectionsBuffer);
    });
    buffer.append(sectionsBuffer);
  }
}

export class ExportNode {
  name: string;
  exportDesc: ExportDescNode;

  constructor(buffer: Buffer) {
    this.name = buffer.readName();
    this.exportDesc = new ExportDescNode(buffer);
  }

  store(buffer: Buffer) {
    buffer.writeName(this.name);
    this.exportDesc.store(buffer);
  }
}

export class ExportDescNode {
  tag: number;
  index: number;

  constructor(buffer: Buffer) {
    this.tag = buffer.readByte();
    this.index = buffer.readU32();
  }

  store(buffer: Buffer) {
    buffer.writeByte(this.tag);
    buffer.writeU32(this.index);
  }
}

export class LocalsNode {
  num: number;
  valType: ValType;

  constructor(buffer: Buffer) {
    this.num = buffer.readU32();
    this.valType = buffer.readByte() as ValType;
  }

  store(buffer: Buffer) {
    buffer.writeU32(this.num);
    buffer.writeByte(this.valType);
  }
}

const OP = {
  BLOCK: 0x02,
  LOOP: 0x03,
  IF: 0x04,
  ELSE: 0x05,
  CALL: 0x10,
  END: 0x0b,
  BR: 0x0c,
  BR_IF: 0x0d,
  LOCAL_GET: 0x20,
  LOCAL_SET: 0x21,
  I32_CONST: 0x41,
  I32_EQZ: 0x45,
  I32_EQ: 0x46,
  I32_NE: 0x47,
  I32_LT_S: 0x48,
  I32_LT_U: 0x49,
  I32_GT_S: 0x4a,
  I32_GT_U: 0x4b,
  I32_LE_S: 0x4c,
  I32_LE_U: 0x4d,
  I32_GE_S: 0x4e,
  I32_GE_U: 0x4f,
  I32_ADD: 0x6a,
  I32_SUB: 0x6b,
  I32_MUL: 0x6c,
  I32_DIV_S: 0x6d,
  I32_DIV_U: 0x6e,
  I32_REM_S: 0x6f,
  I32_REM_U: 0x70,
} as const;
type OP = typeof OP[keyof typeof OP];

type InstrNode =
  | BlockInstrNode
  | LoopInstrNode
  | CallInstrNode
  | BrIfInstrNode
  | BrIfInstrNode
  | IfInstrNode
  | I32ConstInstrNode
  | LocalGetInstrNode
  | LocalSetInstrNode
  | I32AddInstrNode
  | I32EqzInstrNode
  | I32LtSInstrNode
  | I32GeSInstrNode
  | I32RemSInstrNode;

export class ExprNode {
  instrs: InstrNode[] = [];
  endOp!: typeof OP.END | typeof OP.ELSE;

  constructor(buffer: Buffer) {
    while (true) {
      const opcode = buffer.readByte() as OP;
      if (opcode === OP.END || opcode === OP.ELSE) {
        this.endOp = opcode;
        break;
      }
      this.instrs.push(createInstrNode(opcode, buffer));
      if (buffer.eof) break;
    }
  }

  store(buffer: Buffer) {
    for (const instr of this.instrs) {
      instr.store(buffer);
    }
    buffer.writeByte(this.endOp);
  }
}

const createInstrNode = (opcode: OP, buffer: Buffer) => {
  switch (opcode) {
    case OP.BLOCK:
      return new BlockInstrNode(buffer);
    case OP.LOOP:
      return new LoopInstrNode(buffer);
    case OP.BR:
      return new BrInstrNode(buffer);
    case OP.BR_IF:
      return new BrIfInstrNode(buffer);
    case OP.BLOCK:
      return new BlockInstrNode(buffer);
    case OP.IF:
      return new IfInstrNode(buffer);
    case OP.CALL:
      return new CallInstrNode(buffer);
    case OP.I32_CONST:
      return new I32ConstInstrNode(buffer);
    case OP.LOCAL_GET:
      return new LocalGetInstrNode(buffer);
    case OP.LOCAL_SET:
      return new LocalSetInstrNode(buffer);
    case OP.I32_ADD:
      return new I32AddInstrNode();
    case OP.I32_EQZ:
      return new I32EqzInstrNode();
    case OP.I32_LT_S:
      return new I32LtSInstrNode();
    case OP.I32_GE_S:
      return new I32GeSInstrNode();
    case OP.I32_REM_S:
      return new I32RemSInstrNode();
    default:
      throw new Error(`invalid opcode: 0x${opcode.toString(16)}`);
  }
};

export class BlockInstrNode {
  blockType: BlockType;
  instrs: ExprNode;

  constructor(buffer: Buffer) {
    this.blockType = buffer.readByte();
    this.instrs = new ExprNode(buffer);
  }

  store(buffer: Buffer) {
    buffer.writeByte(OP.BLOCK);
  }
}

export class LoopInstrNode {
  blockType: BlockType;
  instrs: ExprNode;

  constructor(buffer: Buffer) {
    this.blockType = buffer.readByte();
    this.instrs = new ExprNode(buffer);
  }

  store(buffer: Buffer) {
    buffer.writeByte(OP.LOOP);
  }
}

export class BrInstrNode {
  labelIdx: LabelIdx;

  constructor(buffer: Buffer) {
    this.labelIdx = buffer.readU32();
  }

  store(buffer: Buffer) {
    buffer.writeByte(OP.BR);
  }
}

export class BrIfInstrNode {
  labelIdx: LabelIdx;

  constructor(buffer: Buffer) {
    this.labelIdx = buffer.readU32();
  }

  store(buffer: Buffer) {
    buffer.writeByte(OP.BR_IF);
  }
}
type LabelIdx = number;

export class IfInstrNode {
  blockType: BlockType;
  thenInstrs: ExprNode;
  elseInstrs?: ExprNode;

  constructor(buffer: Buffer) {
    this.blockType = buffer.readByte();
    this.thenInstrs = new ExprNode(buffer);
    if (this.thenInstrs.endOp === OP.ELSE) {
      this.elseInstrs = new ExprNode(buffer);
    }
  }

  store(buffer: Buffer) {
    buffer.writeByte(OP.IF);
    buffer.writeByte(this.blockType);
    this.thenInstrs.endOp = this.elseInstrs ? OP.ELSE : OP.END;
    this.thenInstrs.store(buffer);
    this.elseInstrs?.store(buffer);
  }
}
type S33 = number;
type BlockType = typeof OP.IF | ValType | S33;

export class CallInstrNode {
  funcIdx: FuncIdx;

  constructor(buffer: Buffer) {
    this.funcIdx = buffer.readU32();
  }

  store(buffer: Buffer) {
    buffer.writeByte(OP.CALL);
  }
}
type FuncIdx = number;

export class I32ConstInstrNode {
  op = OP.I32_CONST;
  num: number;

  constructor(buffer: Buffer) {
    this.num = buffer.readI32();
  }

  store(buffer: Buffer) {
    buffer.writeByte(OP.I32_CONST);
    buffer.writeI32(this.num);
  }
}

export class LocalGetInstrNode {
  op = OP.LOCAL_GET;
  localIdx: number;

  constructor(buffer: Buffer) {
    this.localIdx = buffer.readU32();
  }

  store(buffer: Buffer) {
    buffer.writeByte(OP.LOCAL_GET);
    buffer.writeU32(this.localIdx);
  }
}

export class LocalSetInstrNode {
  op = OP.LOCAL_SET;
  localIdx: number;

  constructor(buffer: Buffer) {
    this.localIdx = buffer.readU32();
  }

  store(buffer: Buffer) {
    buffer.writeByte(OP.LOCAL_SET);
    buffer.writeU32(this.localIdx);
  }
}

export class I32AddInstrNode {
  op = OP.I32_ADD;

  store(buffer: Buffer) {
    buffer.writeByte(OP.I32_ADD);
  }
}
export class I32EqzInstrNode {
  op = OP.I32_EQZ;

  store(buffer: Buffer) {
    buffer.writeByte(OP.I32_EQZ);
  }
}
export class I32LtSInstrNode {
  op = OP.I32_LT_S;

  store(buffer: Buffer) {
    buffer.writeByte(OP.I32_LT_S);
  }
}
export class I32GeSInstrNode {
  op = OP.I32_GE_S;

  store(buffer: Buffer) {
    buffer.writeByte(OP.I32_GE_S);
  }
}
export class I32RemSInstrNode {
  op = OP.I32_REM_S;

  store(buffer: Buffer) {
    buffer.writeByte(OP.I32_REM_S);
  }
}
