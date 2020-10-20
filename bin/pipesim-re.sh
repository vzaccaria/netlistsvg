# ./vz-pipe-new.js pipesim 'add(1)(10)(12),sub(5)(1)(2),add(3)(5)(2)' -n 14 --branchopt | jq '.state.table' | jtbl
# ./vz-pipe-new.js pipesim 'add(1)(10)(12),sub(5)(1)(2),add(3)(5)(2)' -n 14 --alufw --branchopt | jq '.state.table' | jtbl
#./vz-pipe-new.js pipesim 'sub(2)(1)(1),lw(1)(2),add(3)(5)(1)' -n 14 | jq '.state.table' | jtbl
#./vz-pipe-new.js pipesim 'sub(2)(1)(1),lw(1)(2),add(3)(5)(1)' -n 14 --alufw | jq '.state.table' | jtbl
#./vz-pipe-new.js pipesim 'sub(2)(1)(1),lw(1)(2),add(3)(5)(1)' -n 14 --alufw --memfw | jq '.state.table' | jtbl
./vz-pipe-new.js pipesim 'add(1)(10)(12),beq(1)(2),add(3)(1)(2)' -n 14 | jq '.state.table' | jtbl
./vz-pipe-new.js pipesim 'add(1)(10)(12),beq(1)(2),add(3)(1)(2)' -n 14 --alufw   | jq '.state.table' | jtbl
./vz-pipe-new.js pipesim 'add(1)(10)(12),beq(1)(2),add(3)(1)(2),add(4)(4)(4)' -n 14 --alufw --branchopt  | jq '.state.table' | jtbl

